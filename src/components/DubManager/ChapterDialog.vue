<script setup lang="ts">
import { computed, ref } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';

interface ChapterForm {
  id: number;
  name: string;
  content: string;
  sort_order: number;
}

const props = defineProps<{
  visible: boolean;
  type: 'add' | 'edit';
  form: ChapterForm;
  rules: FormRules;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'save'): void;
}>();

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const formRef = ref<FormInstance>();

const handleSave = async () => {
  if (!formRef.value) return;
  await formRef.value.validate((valid) => {
    if (!valid) return;
    emit('save');
  });
};
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="type === 'add' ? '新建章节' : '修改章节'"
    width="600px"
    append-to-body
    class="custom-dialog"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
    >
      <el-form-item label="章节名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入章节标题" />
      </el-form-item>
      <el-form-item label="章节内容" prop="content">
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="12"
          placeholder="在此处粘贴或输入章节正文"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button class="cancel-btn" @click="dialogVisible = false"
          >取消</el-button
        >
        <el-button
          :class="['submit-btn', type]"
          type="primary"
          @click="handleSave"
        >
          {{ type === 'add' ? '创建' : '保存' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
:deep(.custom-dialog) {
  border-radius: 12px;
}

:deep(.custom-dialog .el-dialog__header) {
  margin-right: 0;
  padding: 24px 24px 16px;
  border-bottom: 1px solid #f1f5f9;
}

:deep(.custom-dialog .el-dialog__title) {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}

:deep(.custom-dialog .el-dialog__body) {
  padding: 24px;
}

:deep(.custom-dialog .el-form-item__label) {
  font-weight: 600;
  color: #475569;
  margin-bottom: 8px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
}

.cancel-btn {
  background-color: #f8fafc;
  border-color: #e2e8f0;
  color: #64748b;
  width: 80px;
}

.submit-btn {
  width: 80px;
  border: none;
}

.submit-btn.add {
  background-color: #1e293b;
}

.submit-btn.edit {
  background-color: #2345e6;
}

:deep(.el-button+.el-button) {
  margin-left: 0;
}
</style>
