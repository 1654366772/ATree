<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useStorage } from '@vueuse/core';
import type { Line } from '../../utils/db';
import { splitText, type FcpXmlAudioClip, type FcpXmlSubtitle } from '../../utils/fcpXml';
import { generateJianyingDraft } from '../../utils/jianyingDraft';

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

const maxChars = useStorage('jy-export-max-chars', 15);
const splitByPunctuation = useStorage('jy-export-split-punct', true);
const jianyingDraftsPath = useStorage('jy-export-drafts-path', '');
const isGenerating = ref(false);
const exportSubfolderPath = ref('');

// 根据文章 ID 和章节 ID 持久化导出路径
watch([() => props.articleId, () => props.chapterId, () => props.visible], ([aid, cid, visible]) => {
  if (visible && aid && cid) {
    exportSubfolderPath.value = localStorage.getItem(`jy_path_${aid}_${cid}`) || '';
  }
}, { immediate: true });

const selectDraftsPath = async () => {
  const path = await (window as any).ipcRenderer.invoke('dialog:openDirectory', {
    title: '选择剪映草稿目录 (JianyingPro Drafts)',
    defaultPath: jianyingDraftsPath.value || ''
  });
  if (path) {
    jianyingDraftsPath.value = path;
  }
};

const getFileNameFromPath = (p: string): string => {
  const parts = p.split(/[/\\]/);
  const name = parts[parts.length - 1];
  return name || 'audio.wav';
};

const getFileExt = (fileName: string): string => {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx) : '';
};

const getAudioDuration = async (url: string): Promise<number> => {
  const byAudioElement = await new Promise<number>((resolve, reject) => {
    const a = new Audio();
    a.preload = 'metadata';
    a.addEventListener('loadedmetadata', () => {
      resolve(a.duration * 1000); // 返回毫秒
    });
    a.addEventListener('error', () => {
      reject(new Error('audio element failed'));
    });
    // 如果需要，添加时间戳以防止缓存问题
    const finalUrl = url.includes('?') ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`;
    a.src = finalUrl;
    a.load();
  }).catch(() => NaN);

  if (Number.isFinite(byAudioElement) && byAudioElement > 0) {
    return byAudioElement;
  }

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const arrayBuffer = await resp.arrayBuffer();
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      throw new Error('AudioContext not supported');
    }
    const ctx = new AudioCtx();
    try {
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const durationMs = audioBuffer.duration * 1000;
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        throw new Error('invalid duration');
      }
      return durationMs;
    } finally {
      await ctx.close();
    }
  } catch (e) {
    throw new Error(`无法读取音频文件时长: ${url}`);
  }
};

const getAudioMeta = async (url: string) => {
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const arrayBuffer = await resp.arrayBuffer();
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      throw new Error('AudioContext not supported');
    }
    const ctx = new AudioCtx();
    try {
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      return {
        durationMs: audioBuffer.duration * 1000,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
      };
    } finally {
      await ctx.close();
    }
  } catch {
    return null;
  }
};

const handleGenerate = async () => {
  if (!props.lines || props.lines.length === 0) {
    ElMessage.warning('当前章节没有台词数据');
    return;
  }
  
  if (!props.savePath) {
    ElMessage.warning('请先设置文章的保存路径');
    return;
  }
  
  if (!jianyingDraftsPath.value) {
    ElMessage.warning('请先选择剪映草稿目录');
    return;
  }

  isGenerating.value = true;
  exportSubfolderPath.value = '';
  
  try {
    const clips: FcpXmlAudioClip[] = [];
    
    // 仅处理已生成音频的台词
    const validLines = props.lines.filter(l => l.status === 3 && l.gen_audio);
    
    // 检查配音完成度
    if (validLines.length < props.lines.length) {
      try {
        await ElMessageBox.confirm(
          `当前章节共有 ${props.lines.length} 条台词，其中 ${props.lines.length - validLines.length} 条尚未完成配音，是否继续生成剪映草稿？`,
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

    const draftName = `${props.articleName}_${props.chapterName}`;
    const folderPath = `${jianyingDraftsPath.value}/${draftName}`;
    const draftAudioDir = `${folderPath}/materials/audios`;

    // 生成前清理旧目录
    await (window as any).ipcRenderer.invoke('fs:delete', { filePath: folderPath });

    for (let i = 0; i < validLines.length; i++) {
      const line = validLines[i];
      // 格式化文件路径
      // 尝试构建绝对路径，以匹配 DubManager 中的音频播放逻辑
      let audioAbsPath = line.gen_audio!;
      const isLocalPath = /^[a-zA-Z]:\\/.test(audioAbsPath) || audioAbsPath.startsWith('\\\\');
      if (!isLocalPath && props.savePath) {
        audioAbsPath = `${props.savePath}/${audioAbsPath}`;
      }
      
      const audioUrl = `media://get-file?path=${encodeURIComponent(audioAbsPath)}`;
      const meta = await getAudioMeta(audioUrl);
      const durationMs = meta?.durationMs ?? await getAudioDuration(audioUrl);

      // 复制音频到草稿目录，确保剪映能读取到素材
      const originalName = getFileNameFromPath(audioAbsPath);
      const ext = getFileExt(originalName) || '.wav';
      const safeName = `${String(i + 1).padStart(3, '0')}${ext}`;
      const destAbsPath = `${draftAudioDir}/${safeName}`;
      const copyRes = await (window as any).ipcRenderer.invoke('fs:copyFile', {
        srcPath: audioAbsPath,
        destPath: destAbsPath,
      });
      if (!copyRes.success) {
        throw new Error(`复制音频失败: ${originalName} -> ${destAbsPath}`);
      }

      const fileMeta = await (window as any).ipcRenderer.invoke('fs:getFileMeta', {
        filePath: destAbsPath,
      });

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

      const size = fileMeta?.success ? fileMeta.size : undefined;
      const bitRate = size ? Math.round((size * 8) / (durationMs / 1000)) : undefined;
      const createTime = fileMeta?.success ? Math.floor(fileMeta.ctimeMs / 1000) : undefined;
      const importTime = fileMeta?.success ? Math.floor(fileMeta.mtimeMs / 1000) : undefined;

      clips.push({
        name: `Audio ${i+1}`,
        path: destAbsPath,
        durationMs,
        subtitles,
        sampleRate: meta?.sampleRate,
        channels: meta?.channels,
        bitRate,
        md5: fileMeta?.success ? fileMeta.md5 : undefined,
        createTime,
        importTime,
      });
    }

    const { draftContentStr, draftMetaInfoStr } = generateJianyingDraft(draftName, clips, folderPath, false);
    
    // 保存到文件夹: 根目录/文章名/章节名/[剪映草稿]文章名_章节名/
    
    const writeContentRes = await (window as any).ipcRenderer.invoke('fs:write', {
      filePath: `${folderPath}/draft_content.json`,
      content: draftContentStr
    });
    
    const writeMetaRes = await (window as any).ipcRenderer.invoke('fs:write', {
      filePath: `${folderPath}/draft_meta_info.json`,
      content: draftMetaInfoStr
    });
    
    if (writeContentRes.success && writeMetaRes.success) {
      exportSubfolderPath.value = folderPath;
      // 保存路径到 localStorage
      if (props.articleId && props.chapterId) {
        localStorage.setItem(`jy_path_${props.articleId}_${props.chapterId}`, folderPath);
      }
      ElMessage.success(`成功生成剪映草稿目录！`);
    } else {
      ElMessage.error('保存剪映草稿文件失败');
    }
    
  } catch (err: any) {
    ElMessage.error(err.message || '生成剪映草稿失败');
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
    title="生成剪映草稿"
    width="500px"
    @update:model-value="(val: any) => emit('update:visible', val as boolean)"
  >
    <el-form label-width="120px" class="pr-export-form">
      <el-form-item label="剪映草稿目录">
        <el-input v-model="jianyingDraftsPath" placeholder="请选择剪映草稿目录" readonly>
          <template #append>
            <el-button @click="selectDraftsPath">选择</el-button>
          </template>
        </el-input>
        <div class="tip">
          在剪映全局设置中可以查看剪映草稿目录JianyingPro Drafts
        </div>
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
      <el-alert title="草稿生成成功" type="success" :closable="false">
        草稿已直接保存到剪映草稿目录！现在可以直接在剪映中打开该草稿了。
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
