<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  currentPage: number;
  pageSize: number;
  total: number;
}>();

const emit = defineEmits<{
  (e: 'update:currentPage', value: number): void;
  (e: 'pageSizeChange', value: number): void;
}>();

const currentPageProxy = computed({
  get: () => props.currentPage,
  set: (value) => emit('update:currentPage', value),
});

const pageSizeProxy = computed({
  get: () => props.pageSize,
  set: (value) => emit('pageSizeChange', value),
});
</script>

<template>
  <div class="pagination-box">
    <div class="page-size-selector">
      <span class="label">每页展示:</span>
      <el-input-number
        v-model="pageSizeProxy"
        :min="1"
        :max="100"
        size="small"
        controls-position="right"
      />
      <span class="unit">条</span>
    </div>
    <el-pagination
      v-model:current-page="currentPageProxy"
      :page-size="pageSize"
      layout="prev, pager, next, total"
      :total="total"
      background
    />
  </div>
</template>

<style scoped>
.pagination-box {
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
</style>
