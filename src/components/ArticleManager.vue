<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Search, Plus } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import { initDB } from '../utils/db';
import { ElMessage, ElMessageBox } from 'element-plus';

// 数据接口
interface Article {
  id?: number;
  name: string;
  create_time: Date;
  is_deleted: number;
  save_path?: string;
}

// 状态
const articles = ref<Article[]>([]);
const searchQuery = ref('');
const currentPage = ref(1);
const pageSize = ref(Number(localStorage.getItem('article_page_size')) || 10);
const formRef = ref<any>(null);
const router = useRouter();

const handlePageSizeChange = (val: number) => {
  pageSize.value = val;
  localStorage.setItem('article_page_size', val.toString());
  currentPage.value = 1;
};

// 弹窗状态
const dialogVisible = ref(false);
const dialogType = ref<'add' | 'edit'>('add');
const form = ref({
  id: 0,
  name: '',
});

// 校验规则
const rules = {
  name: [
    { required: true, message: '请输入文章名称', trigger: 'blur' },
    {
      validator: async (rule: any, value: string, callback: any) => {
        if (!value) return callback();
        try {
          const db = await initDB();
          // 在 IndexedDB 中检查名称是否存在（仅针对未删除的数据）
          const existing = await db.getAllFromIndex(
            'article',
            'by-name',
            value,
          );
          const activeDuplicate = existing.find(
            (item) => item.is_deleted === 0 && item.id !== form.value.id,
          );
          if (activeDuplicate) {
            callback(new Error('文章名称已存在，请更换一个'));
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
};

// 计算属性
const filteredArticles = computed(() => {
  let result = articles.value.filter((article) => article.is_deleted === 0);
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter((article) =>
      article.name.toLowerCase().includes(query),
    );
  }
  return result;
});

const paginatedArticles = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredArticles.value.slice(start, end);
});

// 方法
const formatDate = (date: Date) => {
  if (!date) return '';
  const d = new Date(date);
  return `创建于 ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(d.getDate()).padStart(2, '0')}`;
};

const loadArticles = async () => {
  try {
    const db = await initDB();
    const allArticles = await db.getAll('article');
    articles.value = allArticles;
  } catch (error) {
    ElMessage.error('加载文章列表失败：' + error);
  }
};

const handleSearch = () => {
  currentPage.value = 1;
};

const openAddDialog = () => {
  dialogType.value = 'add';
  form.value = { id: 0, name: '' };
  dialogVisible.value = true;
};

const openEditDialog = (article: Article) => {
  dialogType.value = 'edit';
  form.value = { id: article.id || 0, name: article.name };
  dialogVisible.value = true;
};

const handleSubmit = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) return;

    try {
      const db = await initDB();
      if (dialogType.value === 'add') {
        await db.add('article', {
          name: form.value.name,
          create_time: new Date(),
          is_deleted: 0,
        });
        ElMessage.success('文章创建成功');
        } else {
          const original = await db.get('article', form.value.id);
          if (original) {
            if (original.name !== form.value.name && original.save_path) {
              // 重命名物理目录
              const oldPath = `${original.save_path}/${original.name}`;
              const newPath = `${original.save_path}/${form.value.name}`;
              await (window as any).ipcRenderer.invoke('fs:rename', { oldPath, newPath });
            }
            await db.put('article', {
              ...original,
              name: form.value.name,
            });
            ElMessage.success('文章更新成功');
          }
        }
      dialogVisible.value = false;
      loadArticles();
    } catch (error) {
      ElMessage.error('操作失败，该名称可能已被占用：' + error);
    }
  });
};

const handleDelete = (article: Article) => {
  ElMessageBox.confirm('是否确认删除该文章？删除后不可恢复', '确认删除', {
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
    type: 'warning',
    center: true,
    confirmButtonClass: 'el-button--danger',
  })
    .then(async () => {
      try {
        const db = await initDB();
        const original = await db.get('article', article.id || 0);
        if (original) {
          // 逻辑删除
            await db.put('article', {
              ...original,
              is_deleted: 1,
            });

            // 删除物理目录
            if (original.save_path) {
              const dirPath = `${original.save_path}/${original.name}`;
              await (window as any).ipcRenderer.invoke('fs:delete', { filePath: dirPath });
            }

            ElMessage.success('文章删除成功');
          loadArticles();
        }
      } catch (error) {
        ElMessage.error('删除失败：' + error);
      }
    })
    .catch(() => {
      // 已取消
    });
};

const handlePageChange = (page: number) => {
  currentPage.value = page;
};

const handleDubbing = (article: Article) => {
  router.push({ name: 'Dubbing', query: { articleId: article.id } });
};

onMounted(() => {
  loadArticles();
});
</script>

<template>
  <div class="article-container">
    <!-- 头部 -->
    <div class="header">
      <el-button type="primary" class="add-btn" @click="openAddDialog">
        <el-icon><Plus /></el-icon>
        新增文章
      </el-button>
      <div class="search-box">
        <el-input
          v-model="searchQuery"
          placeholder="搜索文章名称"
          :prefix-icon="Search"
          @input="handleSearch"
          clearable
        />
      </div>
    </div>

    <!-- 带滚动条的文章网格容器 -->
    <el-scrollbar class="article-scrollbar">
      <div v-if="paginatedArticles.length === 0" class="empty-state">
        <el-empty description="暂无文章数据" />
      </div>
      <div v-else class="article-grid">
        <div
          v-for="article in paginatedArticles"
          :key="article.id"
          class="article-card"
          @click="handleDubbing(article)"
        >
          <div class="card-content">
            <div class="article-title">{{ article.name }}</div>
            <div class="article-date">
              {{ formatDate(article.create_time) }}
            </div>
          </div>
          <div class="card-actions">
            <el-button link type="info" @click="handleDubbing(article)"
              >配音</el-button
            >
            <el-button link type="info" @click="openEditDialog(article)"
              >编辑</el-button
            >
            <el-button link type="danger" @click="handleDelete(article)"
              >删除</el-button
            >
          </div>
        </div>
      </div>
    </el-scrollbar>

    <!-- 分页 -->
    <div class="pagination-container" v-if="filteredArticles.length > 0">
      <div class="page-size-selector">
        <span class="label">每页展示:</span>
        <el-input-number
          v-model="pageSize"
          :min="1"
          :max="100"
          size="small"
          controls-position="right"
          @change="handlePageSizeChange"
        />
        <span class="unit">条</span>
      </div>
      <el-pagination
        background
        layout="prev, pager, next, total"
        :total="filteredArticles.length"
        :page-size="pageSize"
        :current-page="currentPage"
        @current-change="handlePageChange"
      />
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogType === 'add' ? '新增文章' : '编辑文章'"
      width="400px"
      center
      destroy-on-close
      class="custom-dialog"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent
      >
        <el-form-item label="文章名称" prop="name">
          <el-input
            v-model="form.name"
            placeholder="请输入文章名称"
            @keyup.enter="handleSubmit"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button link @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit" class="confirm-btn"
            >确认</el-button
          >
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.article-container {
  width: 100%;
  height: 100%;
  padding: 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  background-color: white;
  padding: 16px 24px;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  flex-wrap: wrap;
  gap: 16px;
}

.add-btn {
  background-color: #5e72e4;
  border-color: #5e72e4;
  height: 40px;
  padding: 0 20px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.search-box {
  flex: 1;
  max-width: 320px;
  min-width: 200px;
}

:deep(.el-input__wrapper) {
  background-color: #f5f7fa;
  box-shadow: none !important;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
}

:deep(.el-input__wrapper.is-focus) {
  border-color: #5e72e4;
  background-color: white;
}

.article-scrollbar {
  flex: 1;
  overflow: hidden;
}

.article-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  align-content: start;
  padding: 2px; /* 留出阴影和焦点偏移的空间 */
}

.article-card {
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 120px;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  cursor: pointer;
}

.article-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-content {
  margin-bottom: 16px;
}

.article-title {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 8px;
}

.article-date {
  font-size: 12px;
  color: #909399;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.card-actions .el-button {
  padding: 0;
  height: auto;
  font-size: 14px;
}

.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
  background-color: white;
  padding: 12px 24px;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.page-size-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #606266;
}

.page-size-selector :deep(.el-input-number) {
  width: 80px;
}

/* 弹窗样式 */
.dialog-content {
  padding: 10px 0;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-item label {
  color: #606266;
  font-size: 14px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.confirm-btn {
  background-color: #5e72e4;
  border-color: #5e72e4;
  padding: 8px 24px;
}

/* 自定义 Element Plus 样式以匹配设计图 */
:deep(.el-dialog) {
  border-radius: 8px;
}

:deep(.el-dialog__header) {
  margin-right: 0;
  text-align: left;
  font-weight: bold;
}

:deep(.el-dialog__title) {
  font-size: 18px;
  color: #303133;
}

:deep(.el-message-box__headerbtn) {
  top: 10px;
}

.empty-state {
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
