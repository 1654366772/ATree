<script setup lang="ts">
import { computed, ref, nextTick, watch } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import type { Tag } from '../../utils/db';

const props = defineProps<{
  visible: boolean;
  voiceTags: Tag[];
  getTagStyle: (tag: string) => Record<string, string>;
  startEditTagId?: number | null;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'add'): void;
  (e: 'rename', tag: Tag, value: string): void;
  (e: 'delete', id: number): void;
}>();

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const editingTagId = ref<number | null>(null);
const editTagValue = ref('');
const tagInputRef = ref<any[]>([]);

const startEditTag = (tag: Tag) => {
  editingTagId.value = tag.id || null;
  editTagValue.value = tag.value;
  nextTick(() => {
    tagInputRef.value?.[0]?.focus();
  });
};

const saveTag = (tag: Tag) => {
  if (!editTagValue.value.trim()) {
    editingTagId.value = null;
    return;
  }
  emit('rename', tag, editTagValue.value.trim());
  editingTagId.value = null;
};

const cancelEditTag = () => {
  editingTagId.value = null;
};

watch(
  () => props.startEditTagId,
  (id) => {
    if (!id) return;
    const tag = props.voiceTags.find((item) => item.id === id);
    if (tag) startEditTag(tag);
  },
);
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="管理标签"
    width="400px"
    class="tag-manager-dialog"
    append-to-body
  >
    <div class="tag-manager-content">
      <el-alert
        title="提示：双击标签可修改内容，按回车保存，按 Esc 或点击空白处取消。"
        type="info"
        :closable="false"
        show-icon
        class="tag-tip-alert"
      />
      <div class="tag-list">
        <template v-for="tag in voiceTags" :key="tag.id">
          <div class="tag-item" @dblclick="startEditTag(tag)">
            <template v-if="editingTagId === tag.id">
              <el-input
                ref="tagInputRef"
                v-model="editTagValue"
                size="small"
                class="tag-edit-input"
                @keyup.enter="saveTag(tag)"
                @keyup.esc="cancelEditTag"
                @blur="cancelEditTag"
              />
            </template>
            <template v-else>
              <el-tag
                class="manageable-tag"
                :style="getTagStyle(tag.value)"
                closable
                @close="emit('delete', tag.id!)"
              >
                {{ tag.value }}
              </el-tag>
            </template>
          </div>
        </template>
        <el-button size="small" class="add-tag-btn" @click="emit('add')">
          <el-icon>
            <Plus />
          </el-icon>
          新增标签
        </el-button>
      </div>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button type="primary" @click="emit('update:visible', false)"
          >完成</el-button
        >
      </span>
    </template>
  </el-dialog>
</template>

<style scoped>
.tag-manager-content {
  padding: 0;
}

.tag-tip-alert {
  margin-bottom: 20px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.tag-item {
  display: inline-block;
}

.tag-edit-input {
  width: 90px;
}

.manageable-tag {
  cursor: pointer;
}

.add-tag-btn {
  display: flex;
  align-items: center;
  gap: 4px;
}

:deep(.tag-manager-dialog.el-dialog) {
  border-radius: 16px;
}

:deep(.tag-manager-dialog .el-dialog__header) {
  padding: 24px 24px 10px;
  margin: 0;
  font-weight: 700;
}

:deep(.tag-manager-dialog .el-dialog__title) {
  font-size: 18px;
}

:deep(.tag-manager-dialog .el-dialog__body) {
  padding: 10px 24px 20px;
}

:deep(.tag-manager-dialog .el-dialog__footer) {
  padding: 10px 24px 24px;
}
</style>
