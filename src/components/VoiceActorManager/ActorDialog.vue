<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { VideoPlay, VideoPause, Document as DocumentIcon } from '@element-plus/icons-vue';
import type { Tag } from '../../utils/db';

interface ActorForm {
  id: number;
  name: string;
  tags: string[];
  audio_path: string;
}

const props = defineProps<{
  visible: boolean;
  type: 'add' | 'edit';
  form: ActorForm;
  rules: FormRules;
  voiceTags: Tag[];
  getTagStyle: (tag: string, selected?: boolean) => Record<string, string>;
  currentPlayingKey: string;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'submit'): void;
  (e: 'openTagManager'): void;
  (e: 'selectAudio'): void;
  (e: 'playAudio', path?: string, key?: string): void;
}>();

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const formRef = ref<FormInstance>();

const handleSubmit = async () => {
  if (!formRef.value) return;
  await formRef.value.validate((valid) => {
    if (!valid) return;
    emit('submit');
  });
};

watch(
  () => props.visible,
  (val) => {
    if (val) {
      nextTick(() => {
        formRef.value?.clearValidate();
      });
    }
  },
);
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="type === 'add' ? '新增配音员' : '编辑配音员'"
    width="500px"
    class="actor-dialog"
    destroy-on-close
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="80px"
      label-position="top"
      @submit.prevent
    >
      <el-form-item label="名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入配音员名称" />
      </el-form-item>

      <el-form-item label="标签" prop="tags">
        <div class="tag-selector-wrapper">
          <el-select
            v-model="form.tags"
            multiple
            filterable
            placeholder="选择标签"
            style="width: 100%"
          >
            <template #tag>
              <el-tag
                v-for="tag in form.tags"
                :key="tag"
                size="small"
                round
                :style="getTagStyle(tag)"
                closable
                @close="form.tags = form.tags.filter((t) => t !== tag)"
                style="margin-right: 4px"
              >
                {{ tag }}
              </el-tag>
            </template>
            <el-option
              v-for="tag in voiceTags"
              :key="tag.id"
              :label="tag.value"
              :value="tag.value"
            >
              <el-tag
                size="small"
                round
                :style="getTagStyle(tag.value, form.tags.includes(tag.value))"
              >
                {{ tag.value }}
              </el-tag>
            </el-option>
          </el-select>
          <el-button
            size="small"
            link
            type="primary"
            class="manage-tags-link"
            @click="emit('openTagManager')"
          >
            管理标签
          </el-button>
        </div>
      </el-form-item>

      <el-form-item label="音频文件" prop="audio_path">
        <div class="audio-selection">
          <div class="upload-placeholder" @click="emit('selectAudio')">
            <el-icon>
              <DocumentIcon />
            </el-icon>
            <span>{{ form.audio_path ? '已选择音频' : '点击上传' }}</span>
          </div>
          <el-button
            :disabled="!form.audio_path"
            circle
            class="preview-play-btn"
            @click="emit('playAudio', form.audio_path, 'form-preview')"
          >
            <el-icon>
              <component
                :is="
                  currentPlayingKey === 'form-preview'
                    ? VideoPause
                    : VideoPlay
                "
              />
            </el-icon>
          </el-button>
        </div>
        <div v-if="form.audio_path" class="selected-path">
          {{ form.audio_path }}
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">
          {{ type === 'add' ? '确定' : '更新' }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<style scoped>
.tag-selector-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.manage-tags-link {
  align-self: flex-end;
  font-size: 12px;
  padding: 0;
}

.audio-selection {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.upload-placeholder {
  flex: 1;
  height: 48px;
  border: 1.5px dashed #cbd5e1;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-placeholder:hover {
  border-color: #2563eb;
  color: #2563eb;
  background-color: #eff6ff;
}

.selected-path {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
  word-break: break-all;
  line-height: 1.4;
}

.preview-play-btn {
  background-color: #f8fafc;
  border: none;
}

.preview-play-btn:not(:disabled):hover {
  background-color: #f1f5f9;
  color: #2563eb;
}

:deep(.actor-dialog.el-dialog) {
  border-radius: 16px;
}

:deep(.actor-dialog .el-dialog__header) {
  padding: 24px 24px 10px;
  margin: 0;
  font-weight: 700;
}

:deep(.actor-dialog .el-dialog__title) {
  font-size: 18px;
}

:deep(.actor-dialog .el-dialog__body) {
  padding: 10px 24px 20px;
}

:deep(.actor-dialog .el-dialog__footer) {
  padding: 10px 24px 24px;
}
</style>
