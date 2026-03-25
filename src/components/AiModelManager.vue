<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Search, Plus, View, Hide } from '@element-plus/icons-vue';
import { initDB } from '../utils/db';
import { ElMessage } from 'element-plus';
import { AIService } from '../utils/reason-ai';

// 数据接口
interface AiModel {
  id?: number;
  name: string;
  type: string;
  base_url?: string;
  api_key?: string;
  model_ids: string;
  is_deleted: number;
}

// 状态
const models = ref<AiModel[]>([]);
const searchQuery = ref('');
const selectedType = ref('');
const currentPage = ref(1);
const pageSize = ref(Number(localStorage.getItem('ai_model_page_size')) || 10);
const formRef = ref<any>(null);
const showApiKey = ref(false);

// 弹窗状态
const dialogVisible = ref(false);
const dialogType = ref<'add' | 'edit'>('add');
const deleteDialogVisible = ref(false);
const modelToDelete = ref<AiModel | null>(null);

const form = ref({
  id: 0,
  name: '',
  type: '推理',
  base_url: '',
  api_key: '',
  model_ids: '',
});

// 校验函数：检查名称是否存在
const validateModelName = async (rule: any, value: string, callback: any) => {
  if (!value) {
    return callback(new Error('请输入模型名称'));
  }
  try {
    const db = await initDB();
    const existing = await db.getAllFromIndex('ai_model', 'by-name', value);
    const activeDuplicate = existing.find(
      (item: AiModel) => item.is_deleted === 0 && item.id !== form.value.id,
    );
    if (activeDuplicate) {
      return callback(new Error('该模型名称已存在'));
    }
    callback();
  } catch (error) {
    callback();
  }
};

// 校验规则
const rules = {
  name: [
    { required: true, message: '请输入模型名称', trigger: 'blur' },
    { validator: validateModelName, trigger: 'blur' },
  ],
  type: [{ required: true, message: '请选择模型类型', trigger: 'change' }],
};

// 计算属性
const filteredModels = computed(() => {
  let result = models.value.filter((m) => m.is_deleted === 0);

  // 类别筛选
  if (selectedType.value) {
    result = result.filter((m) => m.type === selectedType.value);
  }

  // 名称模糊搜索
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter((m) => m.name.toLowerCase().includes(query));
  }
  return result;
});

const paginatedModels = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredModels.value.slice(start, end);
});

// 方法
const loadModels = async () => {
  try {
    const db = await initDB();
    const allModels = await db.getAll('ai_model');
    models.value = allModels;
  } catch (error) {
    ElMessage.error('加载模型列表失败：' + error);
  }
};

const handleSearch = () => {
  currentPage.value = 1;
};

const handlePageSizeChange = (val: number) => {
  pageSize.value = val;
  localStorage.setItem('ai_model_page_size', val.toString());
  currentPage.value = 1;
};

const openAddDialog = () => {
  dialogType.value = 'add';
  form.value = {
    id: 0,
    name: '',
    type: '推理',
    base_url: '',
    api_key: '',
    model_ids: '',
  };
  showApiKey.value = false;
  dialogVisible.value = true;
};

const openEditDialog = (model: AiModel) => {
  dialogType.value = 'edit';
  form.value = {
    id: model.id || 0,
    name: model.name,
    type: model.type || '推理',
    base_url: model.base_url || '',
    api_key: model.api_key || '',
    model_ids: model.model_ids,
  };
  showApiKey.value = false;
  dialogVisible.value = true;
};

const handleTestConnection = async () => {
  if (!form.value.base_url || !form.value.api_key || !form.value.model_ids) {
    ElMessage.warning('请先填写 Base URL、API Key 和模型 ID');
    return;
  }

  // 使用逗号分隔列表中的第一个模型 ID
  const firstModelId = form.value.model_ids.split(',')[0].trim();
  if (!firstModelId) {
    ElMessage.warning('请提供有效的模型 ID');
    return;
  }

  const config = {
    ...form.value,
    specific_model_id: firstModelId,
  };

  try {
    ElMessage.info('正在测试连接...');
    // 直接创建实例，因为我们要测试表单数据，而不是数据库记录
    const aiService = new AIService(config);

    await aiService.chat([{ role: 'user', content: 'Hello' }]);
    ElMessage.success('连接测试成功！');
  } catch (error: any) {
    ElMessage.error(`连接失败: ${error.message}`);
  }
};

const handleSubmit = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) return;

    try {
      const db = await initDB();
      const data = {
        name: form.value.name.trim(),
        type: form.value.type,
        base_url: form.value.base_url.trim(),
        api_key: form.value.api_key.trim(),
        model_ids: form.value.model_ids.trim(),
        is_deleted: 0,
      };

      if (dialogType.value === 'add') {
        await db.add('ai_model', data);
        ElMessage.success('模型创建成功');
      } else {
        await db.put('ai_model', { ...data, id: form.value.id });
        ElMessage.success('模型更新成功');
      }
      dialogVisible.value = false;
      loadModels();
    } catch (error: any) {
      if (error.name === 'ConstraintError') {
        ElMessage.error('名称已存在，请更换名称');
      } else {
        ElMessage.error('操作失败：' + error);
      }
    }
  });
};

const confirmDelete = (model: AiModel) => {
  modelToDelete.value = model;
  deleteDialogVisible.value = true;
};

const handleDelete = async () => {
  if (!modelToDelete.value) return;

  try {
    const db = await initDB();
    const original = await db.get('ai_model', modelToDelete.value.id || 0);
    if (original) {
      await db.put('ai_model', {
        ...original,
        is_deleted: 1,
      });
      ElMessage.success('模型删除成功');
      deleteDialogVisible.value = false;
      modelToDelete.value = null;
      loadModels();
    }
  } catch (error) {
    ElMessage.error('删除失败：' + error);
  }
};

const getModelIndex = (index: number) => {
  const total = filteredModels.value.length;
  const currentIdx = total - ((currentPage.value - 1) * pageSize.value + index);
  return `#${String(currentIdx).padStart(2, '0')}`;
};

const displayUrlAndId = (model: AiModel) => {
  const url = model.base_url
    ? model.base_url.replace(/^https?:\/\//, '')
    : '未设置 URL';
  const ids = model.model_ids ? model.model_ids.split(',')[0] : '未设置模型';
  const more = model.model_ids && model.model_ids.includes(',') ? '...' : '';
  return `${url} / ${ids}${more}`;
};

onMounted(() => {
  loadModels();
});
</script>

<template>
  <div class="model-container">
    <!-- 头部 -->
    <div class="header">
      <el-button type="primary" class="add-btn" @click="openAddDialog">
        <el-icon><Plus /></el-icon>
        新增AI模型
      </el-button>
      <div class="filter-controls">
        <div class="type-filter">
          <el-select
            v-model="selectedType"
            placeholder="筛选类型"
            clearable
            @change="handleSearch"
          >
            <el-option label="推理模型" value="推理" />
            <el-option label="配音模型" value="配音" />
          </el-select>
        </div>
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
    </div>

    <!-- 带滚动条的模型网格 -->
    <el-scrollbar class="model-scrollbar">
      <div v-if="paginatedModels.length === 0" class="empty-state">
        <el-empty description="暂无AI模型数据" />
      </div>
      <div v-else class="model-grid">
        <div
          v-for="(model, index) in paginatedModels"
          :key="model.id"
          class="model-card"
          @click="openEditDialog(model)"
        >
          <div class="card-header">
            <div class="header-top">
              <h3 class="model-name">
                {{ model.name }}
              </h3>
              <el-tag
                size="small"
                :type="model.type === '推理' ? 'primary' : 'success'"
              >
                {{ model.type || '推理' }}
              </el-tag>
            </div>
          </div>
          <div class="card-body">
            <p class="model-info">{{ displayUrlAndId(model) }}</p>
          </div>
          <div class="card-footer">
            <el-button link type="info" @click="openEditDialog(model)"
              >编辑</el-button
            >
            <el-button link type="danger" @click="confirmDelete(model)"
              >删除</el-button
            >
          </div>
        </div>
      </div>
    </el-scrollbar>

    <!-- 分页 -->
    <div class="pagination-container" v-if="filteredModels.length > 0">
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
        :total="filteredModels.length"
        :page-size="pageSize"
        v-model:current-page="currentPage"
      />
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogType === 'add' ? '新增AI模型' : '编辑AI模型'"
      width="600px"
      append-to-body
      destroy-on-close
      class="model-dialog"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="模型类型" prop="type">
          <el-radio-group v-model="form.type">
            <el-radio-button label="推理">推理模型</el-radio-button>
            <el-radio-button label="配音">配音模型</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <div class="form-row">
          <el-form-item label="名称" prop="name" class="flex-1">
            <el-input v-model="form.name" placeholder="例如：My GPT-4" />
          </el-form-item>
          <el-form-item label="Base URL" prop="base_url" class="flex-1">
            <el-input
              v-model="form.base_url"
              placeholder="https://api.openai.com/v1"
            />
          </el-form-item>
        </div>

        <el-form-item label="API Key" prop="api_key">
          <el-input
            v-model="form.api_key"
            :type="showApiKey ? 'text' : 'password'"
            placeholder="输入您的 API Key"
          >
            <template #suffix>
              <el-icon class="cursor-pointer" @click="showApiKey = !showApiKey">
                <component :is="showApiKey ? Hide : View" />
              </el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="模型ID" prop="model_ids">
          <el-input
            v-model="form.model_ids"
            placeholder="多个用逗号分隔，例如 gpt-4,gpt-3.5-turbo"
          />
        </el-form-item>

        <div class="form-links">
          <el-button link type="primary" @click="handleTestConnection"
            >测试连接</el-button
          >
        </div>
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

    <!-- 删除确认弹窗 -->
    <el-dialog
      v-model="deleteDialogVisible"
      title="确认删除"
      width="400px"
      append-to-body
      class="delete-dialog"
    >
      <div class="delete-msg">是否确认删除该AI模型？已关联文章设置将清空</div>
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
.model-container {
  width: 100%;
  height: 100%;
  padding: 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
  overflow: hidden;
}

.page-title {
  font-size: 28px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 24px 0;
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
}

.search-box {
  width: 250px;
}

.filter-controls {
  display: flex;
  gap: 12px;
  align-items: center;
  flex: 1;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.type-filter {
  width: 150px;
}

:deep(.el-input__wrapper),
:deep(.el-select__wrapper) {
  background-color: #f5f7fa;
  box-shadow: none !important;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
}

:deep(.el-select__wrapper) {
  padding: 0 12px;
}

:deep(.el-input__wrapper.is-focus),
:deep(.el-select__wrapper.is-focused) {
  border-color: #5e72e4;
  background-color: white;
}

.model-scrollbar {
  flex: 1;
  overflow: hidden;
}

.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  padding: 4px;
  align-content: start;
}

.model-card {
  background: white;
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
  border: 1px solid transparent;
  cursor: pointer;
}

.model-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

.card-header {
  margin-bottom: 12px;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.model-name {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.card-body {
  flex: 1;
}

.model-info {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  margin-top: 20px;
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

/* 弹窗样式 */
:deep(.el-dialog) {
  border-radius: 12px;
}

.form-row {
  display: flex;
  gap: 16px;
}

.flex-1 {
  flex: 1;
}

.form-links {
  display: flex;
  gap: 16px;
  margin-top: -8px;
  margin-bottom: 16px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.confirm-btn {
  background-color: #1e293b;
  border-color: #1e293b;
}

.save-btn {
  background-color: #2563eb;
  border-color: #2563eb;
}

.cursor-pointer {
  cursor: pointer;
}

.delete-msg {
  color: #64748b;
  line-height: 1.5;
}

.delete-dialog :deep(.el-button--danger) {
  background-color: #ef4444;
  border-color: #ef4444;
}

.empty-state {
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
