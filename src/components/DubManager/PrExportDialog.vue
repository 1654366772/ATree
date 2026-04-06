<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useStorage } from '@vueuse/core';
import type { Line } from '../../utils/db';
import { splitText, generateFcpXml, type FcpXmlAudioClip, type FcpXmlSubtitle } from '../../utils/fcpXml';

const props = defineProps<{
  visible: boolean;
  lines: Line[];
  articleName: string;
  chapterName: string;
  savePath: string; // 文章的基础保存路径
  articleId?: number;
  chapterId?: number | null;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
}>();

const maxChars = useStorage('pr-export-max-chars', 0);
const splitByPunctuation = useStorage('pr-export-split-punct', true);
const prProjectSavePath = useStorage('pr-export-project-path', '');
const isGenerating = ref(false);
const exportSubfolderPath = ref('');

const selectProjectPath = async () => {
  const path = await (window as any).ipcRenderer.invoke('dialog:openDirectory', {
    title: '选择 PR 工程保存目录',
    defaultPath: prProjectSavePath.value || ''
  });
  if (path) {
    prProjectSavePath.value = path;
  }
};

const getAudioDuration = (url: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    const a = new Audio();
    let settled = false;

    const cleanup = () => {
      a.removeEventListener('loadedmetadata', onLoaded);
      a.removeEventListener('error', onError);
      a.removeEventListener('durationchange', onDurationChange);
    };

    const finish = (durationSec: number) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(durationSec * 1000); // 返回毫秒
    };

    const onError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`无法读取音频文件时长: ${url}`));
    };

    const onDurationChange = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) {
        finish(a.duration);
      }
    };

    const onLoaded = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) {
        finish(a.duration);
        return;
      }
      // 处理 duration = Infinity/NaN 的情况
      a.addEventListener('durationchange', onDurationChange);
      try {
        a.currentTime = 1e101;
      } catch {
        // ignore
      }
      // 超时保护，避免一直卡住
      setTimeout(() => {
        if (!settled) {
          onError();
        }
      }, 3000);
    };

    a.addEventListener('loadedmetadata', onLoaded);
    a.addEventListener('error', onError);

    // 如果需要，添加时间戳以防止缓存问题
    const finalUrl = url.includes('?') ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`;
    a.src = finalUrl;
    a.load();
  });
};

const handleGenerate = async () => {
  if (!props.lines || props.lines.length === 0) {
    ElMessage.warning('当前章节没有台词数据');
    return;
  }
  
  if (!prProjectSavePath.value) {
    ElMessage.warning('请先设置工程保存路径');
    return;
  }

  isGenerating.value = true;
  
  try {
    const clips: FcpXmlAudioClip[] = [];
    
    // 仅处理已生成音频的台词
    const validLines = props.lines.filter(l => l.status === 3 && l.gen_audio);
    
    // 检查配音完成度
    if (validLines.length < props.lines.length) {
      try {
        await ElMessageBox.confirm(
          `当前章节共有 ${props.lines.length} 条台词，其中 ${props.lines.length - validLines.length} 条尚未完成配音，是否继续生成导出文件？`,
          '导出确认',
          {
            confirmButtonText: '继续生成',
            cancelButtonText: '取消',
            type: 'warning'
          }
        );
      } catch (e) {
        // 用户取消
        isGenerating.value = false;
        return;
      }
    }

    if (validLines.length === 0) {
      ElMessage.warning('没有可导出的音频，请先生成台词音频');
      isGenerating.value = false;
      return;
    }

    // 确定目标目录并清理旧目录
    const targetDir = `${prProjectSavePath.value}/${props.articleName}/${props.chapterName}`;
    const audioDir = `${targetDir}/audios`;
    
    await (window as any).ipcRenderer.invoke('fs:delete', { filePath: targetDir });

    for (let i = 0; i < validLines.length; i++) {
      const line = validLines[i];
      // 获取原始音频绝对路径
      let audioAbsPath = line.gen_audio!;
      const isLocalPath = /^[a-zA-Z]:\\/.test(audioAbsPath) || audioAbsPath.startsWith('\\\\');
      if (!isLocalPath && props.savePath) {
        audioAbsPath = `${props.savePath}/${audioAbsPath}`;
      }
      
      const audioUrl = `media://get-file?path=${encodeURIComponent(audioAbsPath)}`;
      const durationMs = await getAudioDuration(audioUrl);
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        throw new Error(`音频时长无效，请检查文件: ${audioAbsPath}`);
      }

      // 拷贝音频到目标目录
      const ext = audioAbsPath.split('.').pop() || 'wav';
      const destName = `${String(i + 1).padStart(3, '0')}.${ext}`;
      const destAbsPath = `${audioDir}/${destName}`;
      
      const copyRes = await (window as any).ipcRenderer.invoke('fs:copyFile', {
        srcPath: audioAbsPath,
        destPath: destAbsPath
      });
      
      if (!copyRes.success) {
        throw new Error(`复制音频失败: ${audioAbsPath} -> ${destAbsPath}`);
      }

      // 字幕分割
      const textSegments = splitText(line.text, maxChars.value, splitByPunctuation.value);
      const totalChars = textSegments.reduce((sum, seg) => sum + seg.length, 0);
      
      const subtitles: FcpXmlSubtitle[] = [];
      for (const seg of textSegments) {
        const proportion = totalChars > 0 ? (seg.length / totalChars) : 0;
        subtitles.push({
          text: seg,
          durationMs: durationMs * proportion
        });
      }

      clips.push({
        name: `Audio ${i+1}`,
        path: destAbsPath,
        durationMs,
        subtitles
      });
    }

    const xmlContent = generateFcpXml(`${props.articleName}_${props.chapterName}`, clips, 30);
    
    // 保存 XML 到目标目录
    const xmlFileName = `${props.articleName}_${props.chapterName}.xml`;
    const exportPath = `${targetDir}/${xmlFileName}`;
    
    const writeRes = await (window as any).ipcRenderer.invoke('fs:write', {
      filePath: exportPath,
      content: xmlContent
    });
    
    if (writeRes.success) {
      exportSubfolderPath.value = targetDir;
      ElMessage.success(`成功生成 PR 工程文件：${xmlFileName}`);
    } else {
      ElMessage.error('保存 XML 文件失败：' + writeRes.error);
    }
    
  } catch (err: any) {
    ElMessage.error(err.message || '生成 PR 工程文件失败');
  } finally {
    isGenerating.value = false;
  }
};

const handleOpenFolder = async () => {
  if (exportSubfolderPath.value) {
    await (window as any).ipcRenderer.invoke('shell:openPath', { directoryPath: exportSubfolderPath.value });
    emit('update:visible', false);
  }
};
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="生成 Premiere Pro 工程"
    width="500px"
    @update:model-value="(val: any) => emit('update:visible', val as boolean)"
  >
    <el-form label-width="120px" class="pr-export-form">
      <el-form-item label="工程保存路径">
        <el-input v-model="prProjectSavePath" placeholder="请选择 PR 工程保存目录" readonly>
          <template #append>
            <el-button @click="selectProjectPath">选择</el-button>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item label="根据字数拆分">
        <el-input-number v-model="maxChars" :min="0" :max="100" />
        <div class="tip">当每段字幕字数超过此数值时进行强制拆分（设为 0 则不按字数拆分）</div>
      </el-form-item>
      
      <el-form-item label="根据标点拆分">
        <el-switch v-model="splitByPunctuation" />
        <div class="tip">开启后优先根据逗号、句号等标点拆分字幕</div>
      </el-form-item>
    </el-form>

    <div v-if="exportSubfolderPath" class="success-alert">
      <el-alert title="工程生成成功" type="success" :closable="false">
        工程文件已生成！把生成好的xml文件拖进Premiere Pro的素材区即可。
      </el-alert>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="emit('update:visible', false)">取消</el-button>
        <el-button type="primary" :loading="isGenerating" @click="handleGenerate">
          开始生成
        </el-button>
        <el-button v-if="exportSubfolderPath" type="success" @click="handleOpenFolder">
          打开目录
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<style scoped>
.pr-export-form {
  padding: 10px 0;
}
.tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
  margin-top: 5px;
  width: 100%;
}
.success-alert {
  margin-top: 15px;
}
</style>
