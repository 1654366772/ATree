<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm'): void;
}>();

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});
</script>

<template>
  <div class="delete-chapter-dialog-wrapper">
    <el-dialog
      :model-value="dialogVisible"
      @update:modelValue="dialogVisible = $event"
      title="确认删除"
      width="440px"
      append-to-body
      class="delete-dialog"
    >
      <div class="delete-content">
        <div class="delete-text">
          <div class="title">确认删除</div>
          <div class="desc">是否确认删除该章节？关联台词将同步删除</div>
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button class="cancel-btn" @click="dialogVisible = false"
            >取消</el-button
          >
          <el-button
            class="confirm-delete-btn"
            type="danger"
            @click="emit('confirm')"
            >确认删除</el-button
          >
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
:deep(.delete-dialog) {
  border-radius: 12px;
}

.delete-content {
  display: flex;
  gap: 16px;
  padding: 10px 0;
}

.delete-text .title {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 8px;
}

.delete-text .desc {
  font-size: 14px;
  color: #64748b;
  line-height: 1.6;
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

.confirm-delete-btn {
  background-color: #f5365c;
  border: none;
  padding: 10px 20px;
}

:deep(.el-button+.el-button) {
  margin-left: 0;
}
</style>

