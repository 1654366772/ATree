<script setup lang="ts">
import { computed } from 'vue';
import type { AiModel, Prompt } from '../../utils/db';

interface SettingsForm {
  inference_model_id?: number;
  inference_model_string: string;
  dubbing_model_id?: number;
  dubbing_model_string: string;
  prompt_id?: number;
  save_path: string;
}

const props = defineProps<{
  visible: boolean;
  settingsForm: SettingsForm;
  inferenceModels: AiModel[];
  dubbingModels: AiModel[];
  prompts: Prompt[];
  availableInferenceSpecificModels: string[];
  availableDubbingSpecificModels: string[];
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'changeInferenceModel'): void;
  (e: 'changeDubbingModel'): void;
  (e: 'browseSavePath'): void;
  (e: 'save'): void;
}>();

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});
</script>

<template>
  <div class="settings-dialog-wrapper">
    <el-dialog
      :model-value="dialogVisible"
      @update:modelValue="dialogVisible = $event"
      title="文章设置"
      width="500px"
      append-to-body
      class="custom-dialog"
    >
      <el-form label-position="top">
        <el-form-item label="推理模型供应商">
          <el-select
            v-model="settingsForm.inference_model_id"
            placeholder="选择一个推理模型供应商"
            clearable
            style="width: 100%"
            @change="emit('changeInferenceModel')"
          >
            <el-option
              v-for="model in inferenceModels"
              :key="model.id"
              :label="model.name"
              :value="model.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item
          label="推理具体模型"
          v-if="availableInferenceSpecificModels.length > 0"
        >
          <el-select
            v-model="settingsForm.inference_model_string"
            placeholder="选择具体使用的模型"
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="mId in availableInferenceSpecificModels"
              :key="mId"
              :label="mId"
              :value="mId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="配音模型供应商">
          <el-select
            v-model="settingsForm.dubbing_model_id"
            placeholder="选择一个配音模型供应商"
            clearable
            style="width: 100%"
            @change="emit('changeDubbingModel')"
          >
            <el-option
              v-for="model in dubbingModels"
              :key="model.id"
              :label="model.name"
              :value="model.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item
          label="配音具体模型"
          v-if="availableDubbingSpecificModels.length > 0"
        >
          <el-select
            v-model="settingsForm.dubbing_model_string"
            placeholder="选择具体使用的模型ID"
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="mId in availableDubbingSpecificModels"
              :key="mId"
              :label="mId"
              :value="mId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="提示词">
          <el-select
            v-model="settingsForm.prompt_id"
            placeholder="选择一个提示词"
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="prompt in prompts"
              :key="prompt.id"
              :label="prompt.name"
              :value="prompt.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="文件保存路径">
          <div style="display: flex; gap: 8px; width: 100%">
            <el-input v-model="settingsForm.save_path" placeholder="生成音频的保存目录" readonly />
            <el-button @click="emit('browseSavePath')">浏览</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button class="cancel-btn" @click="dialogVisible = false"
            >取消</el-button
          >
          <el-button
            class="submit-btn edit"
            type="primary"
            @click="emit('save')"
            >保存</el-button
          >
        </div>
      </template>
    </el-dialog>
  </div>
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

.submit-btn.edit {
  background-color: #2345e6;
}

:deep(.el-button+.el-button) {
  margin-left: 0;
}
</style>

