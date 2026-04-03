<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, reactive, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  initDB,
  type Chapter,
  type Article,
  type Role,
  type Line,
  type Prompt,
  type AiModel,
  type VoiceActor,
} from '../utils/db';
import { AIService } from '../utils/reason-ai';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormRules } from 'element-plus';
import { globalState } from '../utils/globalState';
import ChapterSidebar from './DubManager/ChapterSidebar.vue';
import ContentHeader from './DubManager/ContentHeader.vue';
import DubbingToolbar from './DubManager/DubbingToolbar.vue';
import ScriptTable from './DubManager/ScriptTable.vue';
import RoleListDialog from './DubManager/RoleListDialog.vue';
import ChapterDialog from './DubManager/ChapterDialog.vue';
import DeleteChapterDialog from './DubManager/DeleteChapterDialog.vue';
import RoleDialog from './DubManager/RoleDialog.vue';
import SettingsDialog from './DubManager/SettingsDialog.vue';
import QueueDialog from './DubManager/QueueDialog.vue';
import PrExportDialog from './DubManager/PrExportDialog.vue';
import JianyingExportDialog from './DubManager/JianyingExportDialog.vue';
const route = useRoute();
const router = useRouter();
const articleId = Number(route.query.articleId);

// 状态
const article = ref<Article | null>(null);
const chapters = ref<Chapter[]>([]);
const roles = ref<Role[]>([]);
const lines = ref<Line[]>([]);
const currentChapterId = ref<number | null>(null);
const chapterSearchQuery = ref('');
const isAutoPlay = ref(false);
const isParsing = computed(() => globalState.isChapterParsing(currentChapterId.value));
const isSidebarCollapsed = ref(false);

// 弹窗状态
const chapterDialogVisible = ref(false);
const chapterDialogType = ref<'add' | 'edit'>('add');
const chapterForm = ref({ id: 0, name: '', content: '', sort_order: 0 });

const deleteChapterVisible = ref(false);
const chapterToDelete = ref<any>(null);

const prExportVisible = ref(false);
const jyExportVisible = ref(false);

// 配音队列状态
interface QueueItem {
  line: Line;
  index: number;
  chapterName: string;
}
const dubbingQueue = ref<QueueItem[]>([]);
const queueDialogVisible = ref(false);
const isProcessingQueue = ref(false);
const currentProcessingLineId = ref<number | null>(null);
const heartbeatTimer = ref<any>(null);

// 排序后的配音队列：生成中(2) > 等待中(1) > 失败(4) > 其他
const sortedDubbingQueue = computed(() => {
  return [...dubbingQueue.value].sort((a, b) => {
    const statusOrder: Record<number, number> = { 2: 0, 1: 1, 4: 2 };
    const orderA = statusOrder[a.line.status] ?? 99;
    const orderB = statusOrder[b.line.status] ?? 99;
    return orderA - orderB;
  });
});

const openDubbingFolder = async () => {
  if (!article.value || !article.value.save_path || !currentChapter.value) {
    ElMessage.warning('保存路径或章节信息不完整');
    return;
  }
  
  // 路径规则: 保存路径/文章名/章节名
  const folderPath = `${article.value.save_path}/${article.value.name}/${currentChapter.value.name}`;
  
  const res = await (window as any).ipcRenderer.invoke('shell:openPath', { directoryPath: folderPath });
  if (!res.success) {
    ElMessage.error('打开文件夹失败：' + res.error);
  }
};

// 用于异步流程中的挂载检查
let isComponentMounted = true;
onMounted(() => {
  isComponentMounted = true;
  loadData();
});
onUnmounted(() => {
  isComponentMounted = false;
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.src = '';
    audioPlayer.onended = null;
    audioPlayer.onerror = null;
  }
});

const lastPlayedIndex = ref<number>(-1);

const chapterRules = reactive<FormRules>({
  name: [{ required: true, message: '请输入章节名称', trigger: 'blur' }],
  content: [{ required: true, message: '请输入章节内容', trigger: 'blur' }],
});

const roleDialogVisible = ref(false);
const roleForm = ref({
  id: 0,
  name: '',
  intro: '',
  dubber_id: undefined as number | undefined,
  remote_path: '',
});
const roleDialogType = ref<'add' | 'edit'>('add');
const roleRules = reactive<FormRules>({
  name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
});
const allDubbers = ref<VoiceActor[]>([]);

// 角色管理列表弹窗
const roleListVisible = ref(false);
const roleSearchQuery = ref('');

// 文章设置状态
const settingsDialogVisible = ref(false);
const settingsForm = ref({
  inference_model_id: undefined as number | undefined,
  inference_model_string: '',
  dubbing_model_id: undefined as number | undefined,
  dubbing_model_string: '',
  prompt_id: undefined as number | undefined,
  save_path: '',
});
const inferenceModels = ref<AiModel[]>([]);
const dubbingModels = ref<AiModel[]>([]);
const allPrompts = ref<Prompt[]>([]);

// 计算属性
const filteredChapters = computed(() => {
  if (!chapterSearchQuery.value) return chapters.value;
  const query = chapterSearchQuery.value.toLowerCase();
  return chapters.value.filter((c) => c.name.toLowerCase().includes(query));
});

const filteredRoles = computed(() => {
  if (!roleSearchQuery.value) return roles.value;
  const query = roleSearchQuery.value.toLowerCase();
  return roles.value.filter((r) => r.name.toLowerCase().includes(query));
});

const currentChapter = computed(() =>
  chapters.value.find((c) => c.id === currentChapterId.value),
);

const selectedLineIds = computed(() => {
  if (!currentChapterId.value) return new Set<number>();
  return globalState.getSelectedLineIds(currentChapterId.value);
});

const availableInferenceSpecificModels = computed(() => {
  const model = inferenceModels.value.find(
    (m) => m.id === settingsForm.value.inference_model_id,
  );
  if (!model || !model.model_ids) return [];
  return model.model_ids.split(/[，,]/).map((id) => id.trim());
});

const availableDubbingSpecificModels = computed(() => {
  const model = dubbingModels.value.find(
    (m) => m.id === settingsForm.value.dubbing_model_id,
  );
  if (!model || !model.model_ids) return [];
  return model.model_ids.split(/[，,]/).map((id) => id.trim());
});

const currentDubbingModel = computed(() => {
  if (!article.value?.dubbing_model_id) return null;
  return dubbingModels.value.find(
    (m) => m.id === article.value?.dubbing_model_id,
  );
});

// 状态管理
const emotionUploadingLines = ref<Set<number>>(new Set());

// 方法
const goBack = () => {
  router.push('/article');
};

// 列表多选与行样式逻辑
const handleSelectAll = () => {
  if (!currentChapterId.value) return;
  const set = globalState.getSelectedLineIds(currentChapterId.value);
  if (set.size === lines.value.length) {
    set.clear();
  } else {
    lines.value.forEach(l => set.add(l.id!));
  }
};

const handleSelectInverse = () => {
  if (!currentChapterId.value) return;
  const set = globalState.getSelectedLineIds(currentChapterId.value);
  const currentSelected = new Set(set);
  set.clear();
  lines.value.forEach(l => {
    if (!currentSelected.has(l.id!)) {
      set.add(l.id!);
    }
  });
};

const handleSelectTodo = () => {
  if (!currentChapterId.value) return;
  const set = globalState.getSelectedLineIds(currentChapterId.value);
  set.clear();
  lines.value.forEach(l => {
    if (l.status === 0 || l.status === 4) {
      set.add(l.id!);
    }
  });
};

const toggleSelection = (id: number) => {
  if (!currentChapterId.value) return;
  const set = globalState.getSelectedLineIds(currentChapterId.value);
  if (set.has(id)) {
    set.delete(id);
  } else {
    set.add(id);
  }
};


const loadData = async () => {
  if (!articleId) return;
  try {
    const db = await initDB();

    // 并行加载所有基础数据
    const [
      articleData,
      allChapters,
      allRoles,
      dubbersList,
      allModels,
      promptsList,
    ] = await Promise.all([
      db.get('article', articleId),
      db.getAllFromIndex('chapter', 'by-article_id', articleId),
      db.getAllFromIndex('role', 'by-article_id', articleId),
      db.getAll('dubber'),
      db.getAll('ai_model'),
      db.getAll('prompt'),
    ]);

    article.value = articleData || null;

    // 清理因异常关闭导致的残留状态 (1:等待中, 2:生成中 -> 4:生成失败)
    await cleanupInterruptedTasks();

    // 处理章节
    chapters.value = (allChapters || [])
      .filter((c) => c.is_deleted === 0)
      .sort((a, b) => a.sort_order - b.sort_order);

    if (chapters.value.length > 0) {
      currentChapterId.value = chapters.value[0].id || null;
      await loadChapterLines(currentChapterId.value!);
    }

    // 处理角色
    roles.value = (allRoles || []).filter((r) => r.is_deleted === 0);

    // 处理配音员
    allDubbers.value = (dubbersList || []).filter((d) => d.is_deleted === 0);

    // 处理AI模型并分类
    inferenceModels.value = (allModels || []).filter(
      (m: any) => m.is_deleted === 0 && m.type === '推理',
    );
    dubbingModels.value = (allModels || []).filter(
      (m: any) => m.is_deleted === 0 && m.type === '配音',
    );

    // 处理提示词
    allPrompts.value = (promptsList || []).filter((p) => p.is_deleted === 0);
  } catch (error) {
    ElMessage.error('加载数据失败：' + error);
  }
};

const loadChapterLines = async (chapterId: number) => {
  try {
    const db = await initDB();
    const allLines = await db.getAllFromIndex(
      'line',
      'by-chapter_id',
      chapterId,
    );
    // 过滤删除项并按权重排序（兼容旧数据：若缺 sort_order 则退回 id）
    lines.value = allLines
      .filter((l) => l.is_deleted === 0)
      .sort((a, b) => (a.sort_order ?? a.id ?? 0) - (b.sort_order ?? b.id ?? 0));
  } catch (error) {
    ElMessage.error('加载数据失败：' + error);
  }
};

const cleanupInterruptedTasks = async () => {
  try {
    const db = await initDB();
    const tx = db.transaction('line', 'readwrite');
    const store = tx.objectStore('line');
    let cursor = await store.openCursor();
    while (cursor) {
      if (cursor.value.status === 1 || cursor.value.status === 2) {
        const updatedLine = { ...cursor.value, status: 4, error_msg: '程序意外关闭导致中断' };
        await cursor.update(updatedLine);
      }
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch (error) {
    console.error('Cleanup interrupted tasks failed:', error);
  }
};

const selectChapter = (chapter: any) => {
  // 切换章节时打断播放
  audioPlayer.pause();
  currentPlayingKey.value = '';
  
  currentChapterId.value = chapter.id;
  loadChapterLines(chapter.id);
};

const openAddChapterDialog = () => {
  chapterDialogType.value = 'add';
  chapterForm.value = { id: 0, name: '', content: '', sort_order: 0 };
  chapterDialogVisible.value = true;
};

const openEditChapterDialog = (chapter: any) => {
  chapterDialogType.value = 'edit';
  chapterForm.value = { ...chapter };
  chapterDialogVisible.value = true;
};

const handleSaveChapter = async () => {
  try {
    const db = await initDB();
    const data = {
      article_id: articleId,
      name: chapterForm.value.name,
      content: chapterForm.value.content,
      sort_order:
        chapterDialogType.value === 'add'
          ? chapters.value.length + 1
          : chapterForm.value.sort_order,
      is_deleted: 0,
    };

    if (chapterDialogType.value === 'add') {
      const id = await db.add('chapter', data);
      ElMessage.success('新增章节成功');
      chapterDialogVisible.value = false;

      // 局部刷新章节列表
      const allChapters = await db.getAllFromIndex(
        'chapter',
        'by-article_id',
        articleId,
      );
      chapters.value = allChapters
        .filter((c) => c.is_deleted === 0)
        .sort((a, b) => a.sort_order - b.sort_order);

      // 选中新章节并加载台词
      audioPlayer.pause();
      currentPlayingKey.value = '';
      currentChapterId.value = Number(id);
      await loadChapterLines(currentChapterId.value);
    } else {
      const original = chapters.value.find(c => c.id === chapterForm.value.id);
      if (original && original.name !== chapterForm.value.name) {
        // 重命名目录
        const oldDirPath = `${article.value?.save_path}/${article.value?.name}/${original.name}`;
        const newDirPath = `${article.value?.save_path}/${article.value?.name}/${chapterForm.value.name}`;
        await (window as any).ipcRenderer.invoke('fs:rename', { oldPath: oldDirPath, newPath: newDirPath });
      }
      await db.put('chapter', { ...data, id: chapterForm.value.id });
      ElMessage.success('保存章节成功');
      chapterDialogVisible.value = false;

      // 局部刷新章节列表
      const allChapters = await db.getAllFromIndex(
        'chapter',
        'by-article_id',
        articleId,
      );
      chapters.value = allChapters
        .filter((c) => c.is_deleted === 0)
        .sort((a, b) => a.sort_order - b.sort_order);
    }
  } catch (error) {
    ElMessage.error('保存章节失败：' + error);
  }
};

const openDeleteChapterDialog = (chapter: any) => {
  chapterToDelete.value = chapter;
  deleteChapterVisible.value = true;
};

const confirmDeleteChapter = async () => {
  if (!chapterToDelete.value) return;
  try {
    const db = await initDB();
    // 逻辑删除章节
    await db.put('chapter', { ...chapterToDelete.value, is_deleted: 1 });

    // 同步逻辑删除关联台词
    const allLines = await db.getAllFromIndex(
      'line',
      'by-chapter_id',
      chapterToDelete.value.id,
    );
    for (const line of allLines) {
      await db.put('line', { ...line, is_deleted: 1 });
    }

    ElMessage.success('章节已删除');
    deleteChapterVisible.value = false;

    // 删除物理目录
    const dirPath = `${article.value?.save_path}/${article.value?.name}/${chapterToDelete.value.name}`;
    await (window as any).ipcRenderer.invoke('fs:delete', { filePath: dirPath });

    // 如果删除的是当前章节，重置当前选择
    if (currentChapterId.value === chapterToDelete.value.id) {
      audioPlayer.pause();
      currentPlayingKey.value = '';
      currentChapterId.value = null;
      lines.value = [];
    }

    // 清理剪映导出路径记录
    localStorage.removeItem(`jy_path_${articleId}_${chapterToDelete.value.id}`);

    await loadData();
  } catch (error) {
    ElMessage.error('删除章节失败：' + error);
  }
};

const openAddRoleDialog = () => {
  roleDialogType.value = 'add';
  roleForm.value = { id: 0, name: '', intro: '', dubber_id: undefined, remote_path: '' };
  roleDialogVisible.value = true;
};

const openEditRoleDialog = (role: any) => {
  roleDialogType.value = 'edit';
  roleForm.value = { ...role };
  roleDialogVisible.value = true;
};

const handleSaveRole = async () => {
  try {
    const db = await initDB();
    
    // 1. 如果绑定了配音员，自动上传示例音频作为角色的远程样本
    let remote_path = roleForm.value.remote_path;
    if (roleForm.value.dubber_id) {
      const dubber = allDubbers.value.find(d => d.id === roleForm.value.dubber_id);
      if (dubber && dubber.audio_path) {
        // 调用扩展后的 api:uploadFile
        const uploadResult = await (window as any).ipcRenderer.invoke('api:uploadFile', {
          url: article.value?.dubbing_model_id ? 
               dubbingModels.value.find(m => m.id === article.value!.dubbing_model_id)?.base_url : '', 
          filePath: dubber.audio_path,
          directory: `/role_audio`,
          fileName: roleForm.value.name
        });
        
        if (uploadResult && uploadResult.success) {
          remote_path = uploadResult.data.path; // 假设返回格式一致
        } else {
          ElMessage.error('上传角色示例音频失败：' + uploadResult.error);
          return;
        }
      }
    }

    const data = {
      article_id: articleId,
      name: roleForm.value.name,
      intro: roleForm.value.intro,
      dubber_id: roleForm.value.dubber_id,
      remote_path: remote_path,
      is_deleted: 0,
    };
    
    if (roleDialogType.value === 'add') {
      await db.add('role', data);
    } else {
      await db.put('role', { ...data, id: roleForm.value.id });
    }
    
    ElMessage.success('保存角色成功');
    roleDialogVisible.value = false;
    await loadData();
  } catch (error) {
    ElMessage.error('保存角色失败：' + error);
  }
};

const handleDeleteRole = async (role: any) => {
  try {
    const db = await initDB();
    await db.put('role', { ...role, is_deleted: 1 });

    // 如果正在播放该角色，则中断播放
    if (currentPlayingKey.value === 'role-' + role.id) {
      audioPlayer.pause();
      currentPlayingKey.value = '';
    }

    ElMessage.success('角色已从库中移除');
    await loadData();
  } catch (error) {
    ElMessage.error('删除角色失败：' + error);
  }
};

const getDubberName = (dubberId?: number) => {
  const dubber = allDubbers.value.find((d) => d.id === dubberId);
  return dubber ? dubber.name : '未绑定配音员';
};

const getDubberAudio = (dubberId?: number) => {
  const dubber = allDubbers.value.find((d) => d.id === dubberId);
  return dubber?.audio_path ?? '';
};

const audioPlayer = new Audio();
const currentPlayingKey = ref('');

const playAudio = (path?: string, key?: string) => {
  if (!path) {
    ElMessage.warning('音频路径为空');
    return;
  }

  if (currentPlayingKey.value === key && !audioPlayer.paused) {
    audioPlayer.pause();
    currentPlayingKey.value = '';
    return;
  }

  // 只支持本地音频播放
  let finalUrl = '';
  if (path.startsWith('media://')) {
    finalUrl = path;
  } else {
    const isLocalPath = /^[a-zA-Z]:\\/.test(path) || path.startsWith('\\\\');
    let absoluteLocalPath = '';

    if (isLocalPath) {
      absoluteLocalPath = path;
    } else if (article.value?.save_path && path.startsWith(article.value.name + '/')) {
      absoluteLocalPath = `${article.value.save_path}/${path}`;
    }

    if (absoluteLocalPath) {
      finalUrl = `media://get-file?path=${encodeURIComponent(absoluteLocalPath)}`;
    } else {
      ElMessage.warning('非本地音频或路径非法：无法从本地找到文件');
      return;
    }
  }

  // 添加时间戳防止浏览器缓存
  const timestamp = new Date().getTime();
  if (finalUrl.includes('?')) {
    finalUrl += `&_t=${timestamp}`;
  } else {
    finalUrl += `?_t=${timestamp}`;
  }

  audioPlayer.src = finalUrl;
  currentPlayingKey.value = (key !== undefined && key !== null && key !== '') ? key : path!;
  
  // 提取 ID 以更新 lastPlayedIndex
  if (key) {
    let extractedId: string | null = null;
    if (!isNaN(Number(key))) {
      extractedId = String(key);
    } else {
      // 尝试匹配以数字结尾的 key，如 line-gen-123
      const match = String(key).match(/-(\d+)$/);
      if (match) {
        extractedId = match[1];
      }
    }

    if (extractedId) {
      const idx = lines.value.findIndex(l => String(l.id) === extractedId);
      if (idx !== -1) lastPlayedIndex.value = idx;
    }
  }

  audioPlayer
    .play()
    .then(() => {
      // 这里的已由上面赋值，保持逻辑一致
    })
    .catch((err) => {
      currentPlayingKey.value = '';
      ElMessage.error('播放失败：' + err);
    });
};

audioPlayer.onended = () => {
  currentPlayingKey.value = '';
  
  if (isAutoPlay.value && lastPlayedIndex.value !== -1) {
    const nextIndex = lastPlayedIndex.value + 1;
    if (nextIndex < lines.value.length) {
      let nextLineIndex = -1;
      // 找下一条有音频的
      for (let i = nextIndex; i < lines.value.length; i++) {
        if (lines.value[i].gen_audio) {
          nextLineIndex = i;
          break;
        }
      }

      if (nextLineIndex !== -1) {
        const nextLine = lines.value[nextLineIndex];
        lastPlayedIndex.value = nextLineIndex;
        // 必须使用相同的 key 前缀，否则 UI 状态(VideoPlay/VideoPause 图标)不会更新
        const prefixedKey = nextLine.id !== undefined ? `line-gen-${nextLine.id}` : undefined;
        playAudio(nextLine.gen_audio, prefixedKey);
      } else {
        lastPlayedIndex.value = -1;
      }
    } else {
      lastPlayedIndex.value = -1;
    }
  }
};
audioPlayer.onerror = () => {
  currentPlayingKey.value = '';
};

onUnmounted(() => {
  audioPlayer.pause();
  audioPlayer.src = '';
  audioPlayer.onended = null;
});

// 弹窗关闭时停止角色库预览
watch(roleListVisible, (val) => {
  if (!val && currentPlayingKey.value.startsWith('role-')) {
    audioPlayer.pause();
    currentPlayingKey.value = '';
  }
});

const handleParseScript = async () => {
  if (!currentChapter.value || !currentChapterId.value) {
    ElMessage.warning('请先选择或创建一个章节');
    return;
  }
  
  // 锁定当前章节上下文，防止异步过程中切换章节导致数据错乱
  const targetChapterId = currentChapterId.value;
  const targetChapterName = currentChapter.value.name;
  const targetChapterContent = currentChapter.value.content;

  if (!targetChapterContent) {
    ElMessage.warning('当前章节没有内容可以解析');
    return;
  }

  // 检查文章设置是否完整
  if (!article.value?.inference_model_id || !article.value?.prompt_id) {
    ElMessage.warning('请先在“文章设置”中配置推理模型和提示词');
    return;
  }

  try {
    const db = await initDB();

    // 检查是否有目标章节的台词数据
    const existingLines = await db.getAllFromIndex('line', 'by-chapter_id', targetChapterId);
    const hasActiveLines = existingLines.some(l => l.is_deleted === 0);

    if (hasActiveLines) {
      try {
        await ElMessageBox.confirm(
          '该操作会覆盖原有台词，并删除已生成的配音，是否继续？',
          '解析确认',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning',
          }
        );

        // 如果用户点击确定，删除物理目录
        if (article.value) {
          const dirPath = `${article.value.save_path}/${article.value.name}/${targetChapterName}`;
          await (window as any).ipcRenderer.invoke('fs:delete', { filePath: dirPath });
        }
      } catch (cancel) {
        // 用户点击取消或关闭弹窗
        return;
      }
    }

    globalState.addParsingChapter(targetChapterId);
    
    // 1. 获取提示词内容
    const prompt = await db.get('prompt', article.value.prompt_id);
    if (!prompt) {
      throw new Error('未找到配置的提示词');
    }

    // 2. 初始化 AI 服务
    const aiService = await AIService.createFromId(
      article.value.inference_model_id,
      article.value.inference_model_string,
    );
    if (!aiService) {
      throw new Error('初始化 AI 服务失败，请检查模型配置');
    }

    // 3. 构造请求信息
    // 要求 AI 返回 JSON 格式
    const systemInstruction = `${prompt.content}\n\n请务必以 JSON 数组格式返回解析结果，数组项格式为：{"role": "角色名", "text": "台词内容"}。`;
    const userMessage = `请解析以下小说章节内容：\n\n${targetChapterContent}`;

    // 解析提示词中配置的模型参数
    let modelParams = {};
    if (prompt.params) {
      try {
        modelParams = JSON.parse(prompt.params);
      } catch (e) {
        ElMessage.warning('解析提示词模型参数失败，请检查参数是否为JSON格式:');
      }
    }

    // 4. 调用 AI 接口
    const response = await aiService.chat(
      [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userMessage },
      ],
      modelParams,
    );

    // 5. 解析 AI 返回的 JSON
    let parsedLines: { role: string; text: string; emo_text: string }[] = [];
    try {
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : response.content;
      parsedLines = JSON.parse(jsonStr);
    } catch (e) {
      ElMessage.error('JSON 解析失败：' + e + '\n内容：' + response.content);
      throw new Error('AI 返回的内容格式不正确，解析失败');
    }

    if (!Array.isArray(parsedLines)) {
      throw new Error('AI 返回的结果不是有效的数组格式');
    }

    // 6. 处理角色库（去重并添加新角色）
    const roleNameToId: Record<string, number> = {};
    const existingRoles = await db.getAllFromIndex(
      'role',
      'by-article_id',
      article.value.id!,
    );
    existingRoles.forEach((r) => {
      roleNameToId[r.name] = r.id!;
    });
    for (const item of parsedLines) {
      const roleName = item.role.trim() || '旁白';
      if (!roleNameToId[roleName]) {
        const newRoleId = await db.add('role', {
          article_id: article.value.id!,
          name: roleName,
          intro: '',
          is_deleted: 0,
        });
        roleNameToId[roleName] = newRoleId;
      }
    }

    const allRoles = await db.getAllFromIndex(
      'role',
      'by-article_id',
      article.value.id!,
    );
    roles.value = allRoles.filter((r) => r.is_deleted === 0);

    // 7. 保存台词到数据库
    const tx = db.transaction('line', 'readwrite');
    const lineStore = tx.objectStore('line');
    const existingChapterLines = await lineStore
      .index('by-chapter_id')
      .getAllKeys(targetChapterId);
    for (const key of existingChapterLines) {
      await lineStore.delete(key);
    }
    await tx.done;

    // 批量插入新台词
    const saveTx = db.transaction('line', 'readwrite');
    const saveStore = saveTx.objectStore('line');
    let currentOrder = 0;
    for (const item of parsedLines) {
      const roleName = item.role.trim() || '旁白';
      await saveStore.add({
        chapter_id: targetChapterId,
        role_id: roleNameToId[roleName],
        text: item.text.trim(),
        spk_audio_prompt: '',
        output_path: '',
        emo_audio_prompt: '',
        emo_alpha: 1.0,
        use_emo_text: true,
        emo_text: item.emo_text?.trim()||'绘声绘色，引人入胜的',
        use_random: false,
        interval_silence: 200,
        verbose: false,
        max_text_tokens_per_segment: 120,
        quick_streaming_tokens: 0,
        stream_return: false,
        emo_control: '3',
        more_segment_before: 0,
        do_sample: true,
        top_p: 0.8,
        top_k: 30,
        temperature: 0.8,
        length_penalty: 0.0,
        num_beams: 3,
        repetition_penalty: 10.0,
        max_mel_tokens: 1500,
        happy: 0.0,
        angry: 0.0,
        sad: 0.0,
        afraid: 0.0,
        disgusted: 0.0,
        melancholic: 0.0,
        surprised: 0.0,
        calm: 0.0,
        status: 0,
        is_deleted: 0,
        sort_order: currentOrder++,
      });
    }
    await saveTx.done;

    ElMessage.success(`成功解析并生成 ${parsedLines.length} 条台词`);
    
    // 只有当用户还在当前目标章节时，才刷新列表显示
    if (currentChapterId.value === targetChapterId) {
      await loadChapterLines(targetChapterId);
    }
  } catch (error: any) {
    if (!isComponentMounted) return;
    ElMessage.error('解析脚本失败：' + (error.message || error));
  } finally {
    globalState.removeParsingChapter(targetChapterId);
  }
};

const handleUploadEmoAudio = async (row: Line) => {
  if (!currentDubbingModel.value) {
    ElMessage.warning('请先在“文章设置”中配置配音模型');
    return;
  }

  try {
    const filePath = await (window as any).ipcRenderer.invoke('dialog:openFile');
    if (!filePath) return;

    emotionUploadingLines.value.add(row.id!);

    const base = currentDubbingModel.value.base_url?.replace(/\/+$/, '') || '';
    // 通常上传接口在根路径，如果 base_url 包含了 /v1 (OpenAI 兼容路径)，我们尝试取根路径
    const baseUrl = base.replace(/\/v1$/, '');

    if (!baseUrl) {
      throw new Error('当前配音模型未配置 API 地址');
    }

    const headers: Record<string, string> = {};
    if (currentDubbingModel.value.api_key) {
      headers['Authorization'] = `Bearer ${currentDubbingModel.value.api_key}`;
    }

    // 通过主进程代理上传以绕过浏览器 CORS 限制
    const uploadResult = await (window as any).ipcRenderer.invoke('api:uploadFile', {
      url: baseUrl,
      filePath: filePath,
      headers: headers,
      directory: `/emo_audio`
    });

    if (!uploadResult.success) {
      throw new Error(uploadResult.error || `上传失败: ${uploadResult.status}`);
    }

    const result = uploadResult.data;
    // API 上传成功后返回文件地址
    const uploadedPath = result.path || result.url || result.data?.path;

    if (uploadedPath) {
      row.emo_audio_prompt = uploadedPath;
      row.local_emo_audio = filePath; // 保存本地原始路径
      await handleUpdateLine(row);
      ElMessage.success('上传成功');
    } else {
      throw new Error('服务器未返回有效的文件地址');
    }
  } catch (error: any) {
    if (!isComponentMounted) return;
    ElMessage.error('上传参考音频失败：' + (error.message || error));
  } finally {
    emotionUploadingLines.value.delete(row.id!);
  }
};

const handleUpdateLine = async (line: Line) => {
  // 检查前置条件：如果是有意触发的生成（即点击了生成按钮），增加校验
  // 这里我们通过判断是否需要修改状态来区分普通自动保存和生成行为
  try {
    const db = await initDB();
    // 使用 JSON 对 reactive 对象进行深拷贝以确保存盘的是纯对象
    await db.put('line', JSON.parse(JSON.stringify(line)));

    // 逻辑检查：如果当前用户意图是生成音频（例如在按钮点击回调中扩展逻辑，或在 handleUpdateLine 中检查）
    // 为了满足“点击生成按钮时检查”的要求，我们在调用此方法前或在此方法中通过上下文判断
    // 简单起见，如果 status 变为 1 之前需要校验，我们将其集成在 handleGenerateClick 逻辑中更清晰
    // 但用户要求在 handleUpdateLine 操作处（通常由生成按钮触发）校验
  } catch (error) {
    ElMessage.error('自动保存失败');
  }
};

// 内部执行单条生成的具体逻辑
const executeGeneration = async (line: Line, passedIndex?: number, chapterName?: string) => {
  const index = passedIndex !== undefined ? passedIndex : lines.value.findIndex(l => l.id === line.id);
  const displayIndex = index !== -1 ? index + 1 : '?';
  const actualChapterName = chapterName || currentChapter.value?.name || '未知章节';

  try {
    // 1. 设置状态为生成中，并持久化，防止队列重复拾取导致死循环
    line.status = 2; // 生成中
    line.error_msg = '';
    await handleUpdateLine(line);

    // 2. 前置校验
    if (!article.value?.dubbing_model_id) throw new Error('文章未设置配音模型供应商');
    if (!article.value?.save_path) throw new Error('文章未设置文件保存路径');
    if (!currentDubbingModel.value) throw new Error('当前配音模型未找到，请检查配置');

    // 校验角色及发音人参考音频
    const role = roles.value.find(r => r.id === line.role_id);
    if (!role) throw new Error('当前台词没有指定角色');
    if (!role.remote_path) throw new Error('该角色没有可用的发音人参考音频 (remote_path为空)');

    const baseUrl = currentDubbingModel.value.base_url || '';

    // 3. 检查并补全参考音频
    // 检查角色参考音频
    const spkCheckResult = await (window as any).ipcRenderer.invoke('api:checkFileExists', {
      url: baseUrl,
      path: role.remote_path
    });

    let spkExists = true;
    if (spkCheckResult.success) {
      if (typeof spkCheckResult.data === 'boolean') {
        spkExists = spkCheckResult.data;
      } else if (typeof spkCheckResult.data === 'object' && spkCheckResult.data !== null) {
        spkExists = spkCheckResult.data.exists !== false && spkCheckResult.data.result !== false;
      } else if (typeof spkCheckResult.data === 'string') {
        spkExists = spkCheckResult.data.trim().toLowerCase() !== 'false';
      }
    }

    if (!spkExists) {
      const dubber = allDubbers.value.find(d => d.id === role.dubber_id);
      if (dubber && dubber.audio_path) {
        const uploadResult = await (window as any).ipcRenderer.invoke('api:uploadFile', {
          url: baseUrl, 
          filePath: dubber.audio_path,
          directory: `/role_audio`,
          fileName: role.name
        });
        if (!uploadResult.success) throw new Error('角色音频丢失且重传失败：' + uploadResult.error);
        
        const uploadedPath = uploadResult.data?.path || uploadResult.data?.url;
        if (uploadedPath) {
          role.remote_path = uploadedPath;
          const db = await initDB();
          await db.put('role', JSON.parse(JSON.stringify(role)));
        } else {
          throw new Error('角色音频重传成功但未返回路径');
        }
      } else {
        throw new Error('远程角色音频不存在且本地缺少记录');
      }
    }

    // 检查情感参考音频 (模式1)
    if (line.emo_control === '1' && line.emo_audio_prompt) {
      const emoCheckResult = await (window as any).ipcRenderer.invoke('api:checkFileExists', {
        url: baseUrl,
        path: line.emo_audio_prompt
      });
      
      let emoExists = true;
      if (emoCheckResult.success) {
        if (typeof emoCheckResult.data === 'boolean') emoExists = emoCheckResult.data;
        else if (typeof emoCheckResult.data === 'object') emoExists = emoCheckResult.data.exists !== false;
      }

      if (!emoExists) {
        if (line.local_emo_audio) {
          const uploadResult = await (window as any).ipcRenderer.invoke('api:uploadFile', {
            url: baseUrl,
            filePath: line.local_emo_audio,
            directory: `/emo_audio`
          });
          if (!uploadResult.success) throw new Error('情感音频丢失且重传失败：' + uploadResult.error);
          
          const uploadedPath = uploadResult.data?.path || uploadResult.data?.url;
          if (uploadedPath) {
            line.emo_audio_prompt = uploadedPath;
          } else {
            throw new Error('情感音频重传成功但未返回路径');
          }
        } else {
          throw new Error('远程情感音频不存在且本地缺少记录');
        }
      }
    }

    // 4. 构造请求参数 payload
    const payload: any = {
      text: line.text,
      spk_audio_prompt: role.remote_path!,
      max_text_tokens_per_segment: line.max_text_tokens_per_segment ?? 120,
      interval_silence: line.interval_silence ?? 200,
      do_sample: line.do_sample ?? true,
      top_p: line.top_p ?? 0.8,
      top_k: line.top_k ?? 30,
      temperature: line.temperature ?? 0.8,
      length_penalty: line.length_penalty ?? 0.0,
      num_beams: line.num_beams ?? 3,
      repetition_penalty: line.repetition_penalty ?? 10.0,
      max_mel_tokens: line.max_mel_tokens ?? 1500,
    };

    switch (line.emo_control) {
      case '0': payload.emo_audio_prompt = role.remote_path; break;
      case '1': 
        if (!line.emo_audio_prompt) throw new Error(`请先上传情感参考音频`);
        payload.emo_audio_prompt = line.emo_audio_prompt;
        payload.emo_alpha = line.emo_alpha;
        break;
      case '2':
        payload.use_random = !!line.use_random;
        payload.emo_vector = [
          line.happy ?? 0, line.angry ?? 0, line.sad ?? 0, line.afraid ?? 0,
          line.disgusted ?? 0, line.melancholic ?? 0, line.surprised ?? 0, line.calm ?? 0
        ];
        break;
      case '3':
        if (!line.emo_text) throw new Error(`请先输入文字情感描述`);
        payload.use_random = !!line.use_random;
        payload.use_emo_text = true;
        payload.emo_text = line.emo_text;
        payload.emo_alpha = line.emo_alpha;
        break;
      case '4':
        payload.use_emo_text = true;
        payload.emo_alpha = line.emo_alpha;
        break;
    }

    // 5. 调用推理接口
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (currentDubbingModel.value.api_key) {
      headers['Authorization'] = `Bearer ${currentDubbingModel.value.api_key}`;
    }

    // 4. 更新状态为生成中
    line.status = 2; // 生成中
    await handleUpdateLine(line);

    const fsPath = `${article.value.save_path}/${article.value.name}/${actualChapterName}/${displayIndex}_${role.name}.wav`;

    const response = await (window as any).ipcRenderer.invoke('api:infer', {
      method: 'POST',
      url: baseUrl,
      headers: {
        ...headers,
        'Connection': 'keep-alive'
      },
      data: payload,
      savePath: fsPath
    });

    // 检查是否已手动停止，如果是则不再处理结果
    if (line.status === 4 && line.error_msg === '手动停止') return;
    
    if (response.success && response.savedPath) {
       line.gen_audio = `${article.value.name}/${actualChapterName}/${displayIndex}_${role.name}.wav`; 
       line.status = 3; // 已完成
       if (isComponentMounted) ElMessage.success(`第 ${displayIndex} 行生成成功`);
    } else {
       throw new Error(response.error || '接口调用失败');
    }
    
  } catch (err: any) {
    if (!isComponentMounted) return;
    // 如果是手动停止导致的异常（通常是 fetch 被中止或组件卸载），不再覆盖状态
    if (line.status === 4 && line.error_msg === '手动停止') return;

    line.status = 4; // 生成失败
    line.error_msg = err.message || String(err);
    if (isComponentMounted) ElMessage.error(`第 ${displayIndex} 行生成失败: ${line.error_msg}`);
  } finally {
    // 如果是手动停止，不在此处统一 handleUpdateLine（已经在 removeFromQueue 处理过）
    if (!(line.status === 4 && line.error_msg === '手动停止')) {
      await handleUpdateLine(line);
    }
  }
};

// 心跳检测函数
const checkHeartbeat = async () => {
  if (!currentDubbingModel.value?.base_url) return true;
  const baseUrl = currentDubbingModel.value.base_url || '';
  try {
    const result = await (window as any).ipcRenderer.invoke('api:heartbeat', { 
      url: baseUrl, 
      retries: 3, 
      interval: 1000 
    });
    return result.success;
  } catch (e) {
    return false;
  }
};

// 停止队列并报错
const stopQueueWithError = async (msg: string) => {
  isProcessingQueue.value = false;
  if (heartbeatTimer.value) {
    clearInterval(heartbeatTimer.value);
    heartbeatTimer.value = null;
  }
  
  // 将队列中所有等待和进行中的任务设为失败
  for (const item of dubbingQueue.value) {
    if (item.line.status === 1 || item.line.status === 2) {
      item.line.status = 4;
      item.line.error_msg = msg;
      await handleUpdateLine(item.line);
    }
  }
  dubbingQueue.value = [];
  currentProcessingLineId.value = null;
  ElMessage.error(msg);
};

// 队列处理主循环
const startQueueProcessing = async () => {
  if (isProcessingQueue.value) return;
  
  isProcessingQueue.value = true;
  
  // 启动心跳检测定时器
  if (!heartbeatTimer.value) {
    heartbeatTimer.value = setInterval(async () => {
      const isAlive = await checkHeartbeat();
      if (!isAlive && isProcessingQueue.value) {
        await stopQueueWithError('生成功能连接已关闭');
        return;
      }
    }, 10000); // 每10秒检测一次
  }

  try {
    while (isProcessingQueue.value) {
      // 实时查找队列中第一个需要执行的任务（状态为 1: 等待中）
      const nextItem = dubbingQueue.value.find(item => item.line.status === 1);
      if (!nextItem) break;
      
      currentProcessingLineId.value = nextItem.line.id!;
      try {
        await executeGeneration(nextItem.line, nextItem.index, nextItem.chapterName);
        
        // 只有成功或手动停止才处理移除逻辑
        if (nextItem.line.status === 3) {
          const idx = dubbingQueue.value.findIndex(item => item.line.id === nextItem.line.id);
          if (idx !== -1) dubbingQueue.value.splice(idx, 1);
        }
      } catch (err: any) {
        console.error('Queue item error:', err);
      }
    }
  } finally {
    currentProcessingLineId.value = null;
    isProcessingQueue.value = false;
    if (heartbeatTimer.value) {
      clearInterval(heartbeatTimer.value);
      heartbeatTimer.value = null;
    }
  }
};

const handleGenerateLine = async (line: Line, passedIndex?: number) => {
  const index = passedIndex !== undefined ? passedIndex : lines.value.findIndex(l => l.id === line.id);
  
  const existingItem = dubbingQueue.value.find(item => item.line.id === line.id);
  if (existingItem) {
    // 如果已经在队列中且状态是完成(3)或失败(4)，则重置状态尝试重新开始
    if ([3,4].includes(line.status)) {
      line.status = 1; // 变为等待中
      line.error_msg = '';
      await handleUpdateLine(line);
      if (!isProcessingQueue.value) startQueueProcessing();
      return;
    }
    ElMessage.info(`第 ${index + 1} 行已在队列中`);
    return;
  }

  // 加入队列前重置状态
  if (line.status === 3 || line.status === 4 || line.status === 0) {
    line.status = 1; // 设为等待中
    line.error_msg = '';
    await handleUpdateLine(line);
  }

  dubbingQueue.value.push({ 
    line, 
    index, 
    chapterName: currentChapter.value?.name || '未知章节' 
  });
  startQueueProcessing();
};

const handleBatchGenerate = async () => {
  if (lines.value.length === 0) {
    ElMessage.error('没有可生成的台词，请先解析脚本');
    return;
  }
  
  const set = currentChapterId.value ? globalState.getSelectedLineIds(currentChapterId.value) : null;
  if (!set || set.size === 0) {
    ElMessage.warning('请先在表格左侧勾选需要生成的台词');
    return;
  }

  const selectedLinesWithIndex = lines.value
    .map((l, idx) => ({ 
      line: l, 
      index: idx, 
      chapterName: currentChapter.value?.name || '未知章节' 
    }))
    .filter(item => set.has(item.line.id!));
  
  if (selectedLinesWithIndex.length === 0) {
    ElMessage.info('选中的台词均已生成完毕');
    return;
  }

  let addedCount = 0;
  for (const item of selectedLinesWithIndex) {
    const qi = dubbingQueue.value.find(qi => qi.line.id === item.line.id);
    if (!qi) {
      if (item.line.status === 3 || item.line.status === 4 || item.line.status === 0) {
        item.line.status = 1;
        item.line.error_msg = '';
        await handleUpdateLine(item.line);
      }
      dubbingQueue.value.push(item);
      addedCount++;
    } else {
      // 如果已在队列但失败了，也可以重置状态重新等待
      if (qi.line.status === 4) {
        qi.line.status = 1;
        qi.line.error_msg = '';
        await handleUpdateLine(qi.line);
        addedCount++;
      }
    }
  }

  if (addedCount > 0) {
    ElMessage.success(`已将 ${addedCount} 条任务加入配音队列`);
    startQueueProcessing();
  } else {
    ElMessage.info('所选任务已在队列中');
  }
};

const removeFromQueue = async (id: number) => {
  const index = dubbingQueue.value.findIndex(item => item.line.id === id);
  if (index !== -1) {
    const item = dubbingQueue.value[index];
    // 如果是在队列中（等待或生成中），将其状态设为失败且备注手动停止
    if (item.line.status === 1 || item.line.status === 2) {
      item.line.status = 4;
      item.line.error_msg = '手动停止';
      await handleUpdateLine(item.line);
    }
    dubbingQueue.value.splice(index, 1);
  }
};

// 插入空白行辅助函数
const createEmptyLine = (orderValue: number): Line => {
  return {
    chapter_id: currentChapter.value?.id || 0,
    role_id: undefined,
    text: '',
    status: 0,
    is_deleted: 0,
    emo_control: '0',
    emo_alpha: 0.5,
    do_sample: true,
    top_p: 0.8,
    top_k: 30,
    temperature: 0.8,
    length_penalty: 0.0,
    num_beams: 3,
    repetition_penalty: 10.0,
    max_mel_tokens: 1500,
    max_text_tokens_per_segment: 120,
    interval_silence: 200,
    sort_order: orderValue,
    happy: 0.0,
    angry: 0.0,
    sad: 0.0,
    afraid: 0.0,
    disgusted: 0.0,
    melancholic: 0.0,
    surprised: 0.0,
    calm: 0.0,
    verbose: false,
    quick_streaming_tokens: 0,
    stream_return: false,
    more_segment_before: 0,
    use_emo_text: true,
    use_random: false,
  };
};

const handleInsertFirst = async () => {
  try {
    const db = await initDB();
    // 取当前最小的 sort_order，减 1 作为新 sort_order，确保在最前面
    const minOrder = lines.value.length > 0 ? Math.min(...lines.value.map(l => l.sort_order)) : 0;
    const newLineData = createEmptyLine(minOrder - 1);
    
    // 保存到数据库，让 ID 自增
    const newId = await db.add('line', newLineData);
    const newLine = { ...newLineData, id: newId };
    
    // 直接放入头部
    lines.value.unshift(newLine);
    ElMessage.success('已在首行插入空白行');
  } catch (error) {
    ElMessage.error('插入首行失败');
  }
};

const handleInsertAbove = async (line: Line) => {
  try {
    const db = await initDB();
    const index = lines.value.findIndex(l => l.id === line.id);
    if (index === -1) return;
    
    // 生成一个介于上一行(如果有)和当前行之间的权重，以保持顺序
    let newOrder;
    if (index === 0) {
      newOrder = line.sort_order - 1;
    } else {
      newOrder = (lines.value[index - 1].sort_order + line.sort_order) / 2;
    }
    
    const newLineData = createEmptyLine(newOrder);
    const newId = await db.add('line', newLineData);
    const newLine = { ...newLineData, id: newId };
    
    lines.value.splice(index, 0, newLine);
    ElMessage.success('已在上方插入空白行');
  } catch (error) {
    ElMessage.error('向上插入失败');
  }
};

const handleInsertBelow = async (line: Line) => {
  try {
    const db = await initDB();
    const index = lines.value.findIndex(l => l.id === line.id);
    if (index === -1) return;
    
    // 生成一个介于当前行和下一行(如果有)之间的权重
    let newOrder;
    if (index === lines.value.length - 1) {
      newOrder = line.sort_order + 1;
    } else {
      newOrder = (line.sort_order + lines.value[index + 1].sort_order) / 2;
    }
    
    const newLineData = createEmptyLine(newOrder);
    const newId = await db.add('line', newLineData);
    const newLine = { ...newLineData, id: newId };
    
    lines.value.splice(index + 1, 0, newLine);
    ElMessage.success('已在下方插入空白行');
  } catch (error) {
    ElMessage.error('向下插入失败');
  }
};

const handleDeleteLine = async (line: Line) => {
  try {
    const db = await initDB();
    await db.put('line', { ...line, is_deleted: 1 });
    lines.value = lines.value.filter(l => l.id !== line.id);
    if (currentChapterId.value) {
      globalState.getSelectedLineIds(currentChapterId.value).delete(line.id!);
    }

    // 删除物理文件
    if (line.gen_audio) {
      let delPath = line.gen_audio;
      if (!/^[a-zA-Z]:\\/.test(delPath) && !delPath.startsWith('\\\\') && !delPath.startsWith('/') && article.value?.save_path) {
        delPath = `${article.value.save_path}/${delPath}`;
      }
      await (window as any).ipcRenderer.invoke('fs:delete', { filePath: delPath });
    }
    
    ElMessage.success('台词已删除');
  } catch (error) {
    ElMessage.error('删除台词失败');
  }
};

const openSettings = () => {
  if (article.value) {
    settingsForm.value = {
      inference_model_id: article.value.inference_model_id,
      inference_model_string: article.value.inference_model_string || '',
      dubbing_model_id: article.value.dubbing_model_id,
      dubbing_model_string: article.value.dubbing_model_string || '',
      prompt_id: article.value.prompt_id,
      save_path: article.value.save_path || '',
    };
  }
  settingsDialogVisible.value = true;
};

const handleInferenceModelChange = () => {
  settingsForm.value.inference_model_string = '';
};

const handleDubbingModelChange = () => {
  settingsForm.value.dubbing_model_string = '';
};

const handleBrowseSavePath = async () => {
  const path = await (window as any).ipcRenderer.invoke('dialog:openDirectory');
  if (path) {
    settingsForm.value.save_path = path;
  }
};

const handleSaveSettings = async () => {
  if (!article.value) return;
  try {
    if (article.value.save_path && settingsForm.value.save_path && article.value.save_path !== settingsForm.value.save_path) {
      // 释放可能存在的文件句柄占用，防止在 Windows 上 rename 时报 EPERM 没权限/文件被占用的问题
      audioPlayer.pause();
      audioPlayer.src = '';
      currentPlayingKey.value = '';

      const oldArticlePath = `${article.value.save_path}/${article.value.name}`;
      const newArticlePath = `${settingsForm.value.save_path}/${article.value.name}`;
      
      const res = await (window as any).ipcRenderer.invoke('fs:rename', { oldPath: oldArticlePath, newPath: newArticlePath });
      if (!res.success) {
        ElMessage.error('迁移文件夹失败：' + res.error);
        return;
      }
    }

    const db = await initDB();
    const updatedArticle = {
      ...article.value,
      ...settingsForm.value,
    } as Article;
    await db.put('article', updatedArticle);
    // 更新本地状态
    article.value = updatedArticle;
    ElMessage.success('文章设置已保存');
    settingsDialogVisible.value = false;
  } catch (error) {
    ElMessage.error('保存文章设置失败：' + error);
  }
};


onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="dub-manager">
    <ChapterSidebar
      :collapsed="isSidebarCollapsed"
      :search-query="chapterSearchQuery"
      :chapters="filteredChapters"
      :current-chapter-id="currentChapterId"
      @update:collapsed="isSidebarCollapsed = $event"
      @update:search-query="chapterSearchQuery = $event"
      @select="selectChapter"
      @add="openAddChapterDialog"
      @edit="openEditChapterDialog"
      @delete="openDeleteChapterDialog"
    />

    <div class="main-content">
      <ContentHeader
        :article-name="article?.name || ''"
        :chapter-name="currentChapter?.name || ''"
        :queue-count="dubbingQueue.length"
        @back="goBack"
        @open-settings="openSettings"
        @open-queue="queueDialogVisible = true"
        @open-folder="openDubbingFolder"
      />

      <div class="scroll-area">
        <DubbingToolbar
          :is-parsing="isParsing"
          :auto-play="isAutoPlay"
          @parse="handleParseScript"
          @batch-generate="handleBatchGenerate"
          @open-role-list="roleListVisible = true"
          @open-pr-export="prExportVisible = true"
          @open-jianying-export="jyExportVisible = true"
          @insert-first="handleInsertFirst"
          @update:auto-play="isAutoPlay = $event"
        />

        <ScriptTable
          :lines="lines"
          :roles="roles"
          :selected-line-ids="selectedLineIds"
          :current-playing-key="currentPlayingKey"
          :emotion-uploading-lines="emotionUploadingLines"
          @toggle-selection="toggleSelection"
          @select-all="handleSelectAll"
          @select-inverse="handleSelectInverse"
          @select-todo="handleSelectTodo"
          @update-line="handleUpdateLine"
          @generate-line="handleGenerateLine"
          @insert-above="handleInsertAbove"
          @insert-below="handleInsertBelow"
          @delete-line="handleDeleteLine"
          @play-audio="playAudio"
          @upload-emo-audio="handleUploadEmoAudio"
        />
      </div>
    </div>

    <RoleListDialog
      v-model:visible="roleListVisible"
      :roles="roles"
      :filtered-roles="filteredRoles"
      :role-search-query="roleSearchQuery"
      :current-playing-key="currentPlayingKey"
      :get-dubber-name="getDubberName"
      :get-dubber-audio="getDubberAudio"
      @update:role-search-query="roleSearchQuery = $event"
      @add="openAddRoleDialog"
      @edit="openEditRoleDialog"
      @delete="handleDeleteRole"
      @play-audio="playAudio"
    />

    <ChapterDialog
      v-model:visible="chapterDialogVisible"
      :type="chapterDialogType"
      :form="chapterForm"
      :rules="chapterRules"
      @save="handleSaveChapter"
    />

    <DeleteChapterDialog
      v-model:visible="deleteChapterVisible"
      @confirm="confirmDeleteChapter"
    />

    <RoleDialog
      v-model:visible="roleDialogVisible"
      :type="roleDialogType"
      :form="roleForm"
      :rules="roleRules"
      :all-dubbers="allDubbers"
      @save="handleSaveRole"
    />

    <SettingsDialog
      v-model:visible="settingsDialogVisible"
      :settings-form="settingsForm"
      :inference-models="inferenceModels"
      :dubbing-models="dubbingModels"
      :prompts="allPrompts"
      :available-inference-specific-models="availableInferenceSpecificModels"
      :available-dubbing-specific-models="availableDubbingSpecificModels"
      @change-inference-model="handleInferenceModelChange"
      @change-dubbing-model="handleDubbingModelChange"
      @browse-save-path="handleBrowseSavePath"
      @save="handleSaveSettings"
    />

    <PrExportDialog
      v-model:visible="prExportVisible"
      :lines="lines"
      :save-path="article?.save_path || ''"
      :article-name="article?.name || ''"
      :chapter-name="currentChapter?.name || ''"
      :article-id="articleId"
      :chapter-id="currentChapterId"
    />

    <JianyingExportDialog
      v-model:visible="jyExportVisible"
      :lines="lines"
      :save-path="article?.save_path || ''"
      :article-name="article?.name || ''"
      :chapter-name="currentChapter?.name || ''"
      :article-id="articleId"
      :chapter-id="currentChapterId"
    />

    <QueueDialog
      v-model:visible="queueDialogVisible"
      :queue="sortedDubbingQueue"
      :roles="roles"
      @retry="handleGenerateLine"
      @remove="removeFromQueue"
    />
  </div>
</template>

<style scoped>
.dub-manager {
  display: flex;
  height: 100%;
  width: 100%;
  background-color: #f5f7fa;
  overflow: hidden;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.scroll-area {
  flex: 1;
  overflow: hidden;
  padding: 24px;
  display: flex;
  flex-direction: column;
}
</style>
