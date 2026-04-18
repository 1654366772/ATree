<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { initDB, type VoiceActor, type Tag } from '../utils/db';
import { ElMessage, ElMessageBox } from 'element-plus';
import HeaderToolbar from './VoiceActorManager/HeaderToolbar.vue';
import ActorGrid from './VoiceActorManager/ActorGrid.vue';
import PaginationBar from './VoiceActorManager/PaginationBar.vue';
import ActorDialog from './VoiceActorManager/ActorDialog.vue';
import TagManagerDialog from './VoiceActorManager/TagManagerDialog.vue';

// 数据接口
interface Dubber extends VoiceActor {
  _tagSet?: Set<string>; // 缓存标签集合以提升搜索性能
}

// 状态
const dubbers = ref<Dubber[]>([]);
const loading = ref(false);
const tags = ref<Tag[]>([]);
const searchQuery = ref('');
const selectedTags = ref<string[]>([]);
const currentPage = ref(1);
const pageSize = ref(
  Number(localStorage.getItem('voice_actor_page_size')) || 10,
);

const handlePageSizeChange = (val: number) => {
  pageSize.value = val;
  localStorage.setItem('voice_actor_page_size', val.toString());
  currentPage.value = 1;
};

// 弹窗状态
const dialogVisible = ref(false);
const showTagManager = ref(false);
const dialogType = ref<'add' | 'edit'>('add');
const form = ref({
  id: 0,
  name: '',
  tags: [] as string[],
  audio_path: '',
});
const isSelectingFile = ref(false);
const tagManagerEditId = ref<number | null>(null);

const rules = {
  name: [
    { required: true, message: '请输入配音员名称', trigger: 'blur' },
    { min: 1, max: 20, message: '长度在 1 到 20 个字符', trigger: 'blur' },
    {
      validator: async (rule: any, value: string, callback: any) => {
        if (!value) return callback();
        try {
          const db = await initDB();
          // 在 IndexedDB 中检查名称是否存在（仅针对未删除的数据）
          const existing = await db.getAllFromIndex('dubber', 'by-name', value);
          const activeDuplicate = existing.find(
            (item) => item.is_deleted === 0 && item.id !== form.value.id,
          );
          if (activeDuplicate) {
            callback(new Error('配音员名称已存在，请更换一个'));
          } else {
            callback();
          }
        } catch (e) {
          callback();
        }
      },
      trigger: 'blur',
    },
  ],
  tags: [
    {
      type: 'array',
      required: true,
      message: '请至少选择一个标签',
      trigger: 'change',
    },
  ],
  audio_path: [
    { required: true, message: '请选择示例音频文件', trigger: 'change' },
  ],
};

// 计算属性
const voiceTags = computed(() =>
  tags.value.filter((t) => t.type === 'voice' && t.is_deleted === 0),
);

const filteredDubbers = computed(() => {
  let result = dubbers.value.filter((d) => d.is_deleted === 0);

  // 名称搜索
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter((d) => d.name.toLowerCase().includes(query));
  }

  // 标签搜索与排序（OR 逻辑 + 匹配度权重）
  if (selectedTags.value.length > 0) {
    const scoredResults = result.map((d) => {
      // 使用缓存的标签集合进行高效匹配
      let matchCount = 0;
      if (d._tagSet) {
        selectedTags.value.forEach(tag => {
          if (d._tagSet!.has(tag)) matchCount++;
        });
      } else {
        const actorTags = d.tags.split(',').filter((t) => t);
        matchCount = selectedTags.value.filter((tag) =>
          actorTags.includes(tag),
        ).length;
      }
      return { dubber: d, matchCount };
    });

    // 只要有一个标签匹配就展示，并按匹配数量从高到低排序
    result = scoredResults
      .filter((item) => item.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount)
      .map((item) => item.dubber);
  }

  return result;
});

const paginatedDubbers = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredDubbers.value.slice(start, end);
});

// 音频播放逻辑
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

  audioPlayer.src = `media://get-file?path=${encodeURIComponent(path)}`;

  audioPlayer
    .play()
    .then(() => {
      currentPlayingKey.value = key || path;
    })
    .catch((err) => {
      currentPlayingKey.value = '';
      ElMessage.error('播放失败：' + err);
    });
};

audioPlayer.onended = () => {
  currentPlayingKey.value = '';
};
audioPlayer.onerror = () => {
  currentPlayingKey.value = '';
};

onUnmounted(() => {
  audioPlayer.pause();
  audioPlayer.src = '';
  audioPlayer.onended = null;
  audioPlayer.onerror = null;
});

// 弹窗关闭时停止预览
watch(dialogVisible, (val) => {
  if (!val && currentPlayingKey.value === 'form-preview') {
    audioPlayer.pause();
    currentPlayingKey.value = '';
  }
});

// 数据加载
const loadData = async () => {
  loading.value = true;
  try {
    const db = await initDB();
    const [allDubbers, allTags] = await Promise.all([
      db.getAll('dubber'),
      db.getAll('tag'),
    ]);
    dubbers.value = allDubbers.map(d => ({
      ...d,
      _tagSet: new Set(d.tags.split(',').filter(t => t))
    }));
    tags.value = allTags;
  } catch (error) {
    ElMessage.error('加载数据失败：' + error);
  } finally {
    loading.value = false;
  }
};

// 标签操作
const handleAddTag = async () => {
  try {
    const db = await initDB();
    const newTagValue = '新标签';
    const id = await db.add('tag', {
      type: 'voice',
      value: newTagValue,
      is_deleted: 0,
    });

    await loadData();
    tagManagerEditId.value = id;
  } catch (error) {
    ElMessage.error('新增标签失败');
  }
};

const handleRenameTag = async (tag: Tag, value: string) => {
  try {
    const db = await initDB();
    await db.put('tag', {
      ...tag,
      value,
    });
    loadData();
    ElMessage.success('标签已更新');
  } catch (error) {
    ElMessage.error('更新标签失败');
  }
};

const handleDeleteTag = async (id: number) => {
  try {
    const db = await initDB();
    const tag = await db.get('tag', id);
    if (tag) {
      await db.put('tag', { ...tag, is_deleted: 1 });
      loadData();
      ElMessage.success('标签已删除');
    }
  } catch (error) {
    ElMessage.error('删除标签失败');
  }
};

// 配音员操作
const handleSearch = () => {
  currentPage.value = 1;
};

const openAddDialog = () => {
  dialogType.value = 'add';
  form.value = {
    id: 0,
    name: '',
    tags: [],
    audio_path: '',
  };
  dialogVisible.value = true;
};

const openEditDialog = (dubber: Dubber) => {
  dialogType.value = 'edit';
  form.value = {
    id: dubber.id || 0,
    name: dubber.name,
    tags: dubber.tags ? dubber.tags.split(',') : [],
    audio_path: dubber.audio_path || '',
  };
  dialogVisible.value = true;
};

const handleUpload = async () => {
  if (isSelectingFile.value) return;
  isSelectingFile.value = true;
  try {
    const filePath = await (window as any).ipcRenderer.invoke(
      'dialog:openFile',
    );
    if (filePath) {
      form.value.audio_path = filePath;
    }
  } catch (error) {
    ElMessage.error('选择文件失败：' + error);
  } finally {
    isSelectingFile.value = false;
  }
};

const handleSubmit = async () => {
  try {
    const db = await initDB();
    const data: VoiceActor = {
      name: form.value.name.trim(),
      tags: form.value.tags.join(','),
      audio_path: form.value.audio_path,
      is_deleted: 0,
    };

    if (dialogType.value === 'add') {
      await db.add('dubber', data);
      ElMessage.success('配音员添加成功');
    } else {
      await db.put('dubber', { ...data, id: form.value.id });
      ElMessage.success('配音员更新成功');
    }
    dialogVisible.value = false;
    loadData();
  } catch (error) {
    ElMessage.error('保存失败：' + error);
  }
};

const handleDelete = (dubber: Dubber) => {
  ElMessageBox.confirm(
    '是否确认删除该配音员？已关联角色将解除绑定',
    '确认删除',
    {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning',
      center: true,
      confirmButtonClass: 'el-button--danger',
    },
  )
    .then(async () => {
      try {
        const db = await initDB();
        await db.put('dubber', { ...dubber, is_deleted: 1 });
        
        // 如果正在播放该配音员，则中断播放
        if (currentPlayingKey.value === 'actor-' + dubber.id) {
          audioPlayer.pause();
          currentPlayingKey.value = '';
        }

        ElMessage.success('删除成功');
        loadData();
      } catch (error) {
        ElMessage.error('删除失败：' + error);
      }
    })
    .catch(() => {});
};

// 获取标签颜色样式
const getTagStyle = (tagValue: string, isSelected = false) => {
  const colors = [
    { bg: '#e0f2fe', text: '#0ea5e9' },
    { bg: '#fce7f3', text: '#ec4899' },
    { bg: '#fef3c7', text: '#f59e0b' },
    { bg: '#dcfce7', text: '#22c55e' },
    { bg: '#ede9fe', text: '#8b5cf6' },
    { bg: '#f1f5f9', text: '#64748b' },
  ];

  const hash = tagValue
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const color = colors[hash % colors.length];

  return {
    backgroundColor: isSelected ? color.text : color.bg,
    color: isSelected ? 'white' : color.text,
  };
};

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="voice-actor-manager" v-loading="loading">
    <HeaderToolbar
      :selected-tags="selectedTags"
      :voice-tags="voiceTags"
      :search-query="searchQuery"
      :get-tag-style="getTagStyle"
      @update:selected-tags="selectedTags = $event"
      @update:search-query="searchQuery = $event"
      @search="handleSearch"
      @open-add="openAddDialog"
    />

    <ActorGrid
      :actors="paginatedDubbers"
      :current-playing-key="currentPlayingKey"
      :get-tag-style="getTagStyle"
      @play-audio="playAudio"
      @edit="openEditDialog"
      @delete="handleDelete"
    />

    <PaginationBar
      v-if="filteredDubbers.length > 0"
      :current-page="currentPage"
      :page-size="pageSize"
      :total="filteredDubbers.length"
      @update:current-page="currentPage = $event"
      @page-size-change="handlePageSizeChange"
    />

    <ActorDialog
      v-model:visible="dialogVisible"
      :type="dialogType"
      :form="form"
      :rules="rules"
      :voice-tags="voiceTags"
      :get-tag-style="getTagStyle"
      :current-playing-key="currentPlayingKey"
      @submit="handleSubmit"
      @open-tag-manager="showTagManager = true"
      @select-audio="handleUpload"
      @play-audio="playAudio"
    />

    <TagManagerDialog
      v-model:visible="showTagManager"
      :voice-tags="voiceTags"
      :get-tag-style="getTagStyle"
      :start-edit-tag-id="tagManagerEditId"
      @add="handleAddTag"
      @rename="handleRenameTag"
      @delete="handleDeleteTag"
    />
  </div>
</template>

<style scoped>
.voice-actor-manager {
  padding: 24px;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background-color: #f5f7fa;
  overflow: hidden;
  width: 100%;
}
</style>
