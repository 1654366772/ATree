<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Search, Plus } from '@element-plus/icons-vue';
import { initDB } from '../utils/db';
import { ElMessage, ElMessageBox } from 'element-plus';

// 数据接口
interface Prompt {
  id?: number;
  name: string;
  content: string;
  params?: string;
  is_deleted: number;
}

// 状态
const prompts = ref<Prompt[]>([]);
const searchQuery = ref('');
const currentPage = ref(1);
const pageSize = ref(Number(localStorage.getItem('prompt_page_size')) || 10);
const formRef = ref<any>(null);

// 弹窗状态
const dialogVisible = ref(false);
const dialogType = ref<'add' | 'edit'>('add');
const deleteDialogVisible = ref(false);
const promptToDelete = ref<Prompt | null>(null);

const form = ref({
  id: 0,
  name: '',
  content: '',
  params: '',
});

// 校验函数：检查名称是否存在
const validatePromptName = async (rule: any, value: string, callback: any) => {
  if (!value) {
    return callback(new Error('请输入提示词名称'));
  }
  try {
    const db = await initDB();
    const existing = await db.getAllFromIndex('prompt', 'by-name', value);
    const activeDuplicate = existing.find(
      (item: Prompt) => item.is_deleted === 0 && item.id !== form.value.id,
    );
    if (activeDuplicate) {
      return callback(new Error('该提示词名称已存在'));
    }
    callback();
  } catch (error) {
    callback();
  }
};

// 校验规则
const rules = {
  name: [
    { required: true, message: '请输入提示词名称', trigger: 'blur' },
    { max: 20, message: '长度在 20 个字符以内', trigger: 'blur' },
    { validator: validatePromptName, trigger: 'blur' },
  ],
  content: [{ required: true, message: '请输入提示词内容', trigger: 'blur' }],
};

// 计算属性
const filteredPrompts = computed(() => {
  let result = prompts.value.filter((p) => p.is_deleted === 0);
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.content.toLowerCase().includes(query),
    );
  }

  return result;
});

const paginatedPrompts = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredPrompts.value.slice(start, end);
});

// 方法
const loadPrompts = async () => {
  try {
    const db = await initDB();
    const allPrompts = await db.getAll('prompt');
    prompts.value = allPrompts;
  } catch (error) {
    ElMessage.error('加载提示词列表失败：' + error);
  }
};

const handleSearch = () => {
  currentPage.value = 1;
};

const handlePageSizeChange = (val: number) => {
  pageSize.value = val;
  localStorage.setItem('prompt_page_size', val.toString());
  currentPage.value = 1;
};

const openAddDialog = () => {
  dialogType.value = 'add';
  form.value = { id: 0, name: '', content: '', params: '' };
  dialogVisible.value = true;
};

const openEditDialog = (prompt: Prompt) => {
  dialogType.value = 'edit';
  form.value = {
    id: prompt.id || 0,
    name: prompt.name,
    content: prompt.content,
    params: prompt.params || '',
  };
  dialogVisible.value = true;
};

const handleSubmit = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) return;

    try {
      const db = await initDB();
      const data = {
        name: form.value.name.trim(),
        content: form.value.content.trim(),
        params: form.value.params.trim(),
        is_deleted: 0,
      };

      if (dialogType.value === 'add') {
        await db.add('prompt', data);
        ElMessage.success('提示词创建成功');
      } else {
        await db.put('prompt', { ...data, id: form.value.id });
        ElMessage.success('提示词更新成功');
      }
      dialogVisible.value = false;
      loadPrompts();
    } catch (error: any) {
      if (error.name === 'ConstraintError') {
        ElMessage.error('名称已存在，请更换名称');
      } else {
        ElMessage.error('操作失败：' + error);
      }
    }
  });
};

const confirmDelete = (prompt: Prompt) => {
  promptToDelete.value = prompt;
  deleteDialogVisible.value = true;
};

const handleDelete = async () => {
  if (!promptToDelete.value) return;

  try {
    const db = await initDB();
    const original = await db.get('prompt', promptToDelete.value.id || 0);
    if (original) {
      // 逻辑删除
      await db.put('prompt', {
        ...original,
        is_deleted: 1,
      });
      ElMessage.success('提示词删除成功');
      deleteDialogVisible.value = false;
      promptToDelete.value = null;
      loadPrompts();
    }
  } catch (error) {
    ElMessage.error('删除失败：' + error);
  }
};

onMounted(() => {
  loadPrompts();
});
</script>

<template>
  <div class="prompt-container">
    <!-- Header -->
    <div class="header">
      <el-button type="primary" class="add-btn" @click="openAddDialog">
        <el-icon><Plus /></el-icon>
        新增提示词
      </el-button>
      <div class="search-box">
        <el-input
          v-model="searchQuery"
          placeholder="搜索名称"
          :prefix-icon="Search"
          @input="handleSearch"
          clearable
        />
      </div>
    </div>

    <!-- Prompt Grid wrapped with scrollbar -->
    <el-scrollbar class="prompt-scrollbar">
      <div v-if="paginatedPrompts.length === 0" class="empty-state">
        <el-empty description="暂无提示词数据" />
      </div>
      <div v-else class="prompt-grid">
        <div
          v-for="(prompt, index) in paginatedPrompts"
          :key="prompt.id"
          class="prompt-card"
          @click="openEditDialog(prompt)"
        >
          <div class="card-header">
            <h3 class="prompt-name">{{ prompt.name }}</h3>
          </div>
          <div class="card-body">
            <p class="prompt-content">{{ prompt.content }}</p>
          </div>
          <div class="card-footer">
            <el-button link type="primary" @click="openEditDialog(prompt)"
              >编辑</el-button
            >
            <el-button link type="danger" @click="confirmDelete(prompt)"
              >删除</el-button
            >
          </div>
        </div>
      </div>
    </el-scrollbar>

    <!-- Pagination -->
    <div class="pagination-container" v-if="filteredPrompts.length > 0">
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
        :total="filteredPrompts.length"
        :page-size="pageSize"
        v-model:current-page="currentPage"
      />
    </div>

    <!-- Add/Edit Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogType === 'add' ? '新增提示词' : '编辑提示词'"
      width="600px"
      append-to-body
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="left"
        label-width="100px"
      >
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：温柔女声" />
        </el-form-item>
        <el-form-item label="提示词内容" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="20"
            placeholder="在此输入或粘贴详细的提示词..."
          />
        </el-form-item>
        <el-form-item label="模型参数" prop="params">
          <el-input
            v-model="form.params"
            type="textarea"
            :rows="5"
            placeholder='例如：{"temperature": 0.7}'
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button
            type="primary"
            @click="handleSubmit"
            :class="dialogType === 'add' ? 'confirm-btn' : 'save-btn'"
          >
            {{ dialogType === 'add' ? '确认' : '保存' }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Delete Confirm Dialog -->
    <el-dialog
      v-model="deleteDialogVisible"
      title="确认删除"
      width="400px"
      append-to-body
      class="delete-dialog"
    >
      <div class="delete-msg">是否确认删除该提示词？已关联文章设置将清空</div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="deleteDialogVisible = false">取消</el-button>
          <el-button type="danger" @click="handleDelete">确认删除</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.prompt-container {
  width: 100%;
  height: 100%;
  padding: 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
  overflow: hidden;
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

.page-title {
  font-size: 28px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 24px 0;
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
  width: 280px;
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

.prompt-scrollbar {
  flex: 1;
  overflow: hidden;
}

.prompt-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
  padding: 4px;
  padding-bottom: 20px;
}

.prompt-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  border: 1px solid #e2e8f0;
  cursor: pointer;
}

.prompt-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

.prompt-no {
  font-size: 14px;
  color: #94a3b8;
  font-family: monospace;
}

.card-body {
  flex: 1;
  margin-top: 12px;
}

.prompt-name {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 12px 0;
}

.prompt-content {
  font-size: 14px;
  color: #64748b;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  height: 100%;
  overflow-y: hidden;
  margin: 0;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #f1f5f9;
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
  color: #64748b;
}

.page-size-selector :deep(.el-input-number) {
  width: 80px;
}

/* Dialog Styles */
:deep(.el-dialog) {
  border-radius: 12px;
}

:deep(.el-dialog__header) {
  padding: 24px 24px 10px;
}

:deep(.el-dialog__title) {
  font-weight: 600;
}

:deep(.el-dialog__body) {
  padding: 20px 24px;
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: #64748b;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 10px 0;
}

.confirm-btn {
  background-color: #1e293b;
  border-color: #1e293b;
}

.save-btn {
  background-color: #2563eb;
  border-color: #2563eb;
}

.delete-msg {
  color: #64748b;
  line-height: 1.5;
}

.delete-dialog :deep(.el-button--danger) {
  background-color: #ef4444;
  border-color: #ef4444;
}

/* Dark mode adjustments if needed */
:global(.dark) .prompt-card {
  background-color: #1e293b;
  border-color: #334155;
}

:global(.dark) .prompt-name {
  color: #f1f5f9;
}

:global(.dark) .prompt-content {
  color: #94a3b8;
}

:global(.dark) .page-title {
  color: #f1f5f9;
}

.empty-state {
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
