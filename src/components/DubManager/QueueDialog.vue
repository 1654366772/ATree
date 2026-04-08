<script setup lang="ts">
import { computed } from 'vue';
import { Refresh, Delete } from '@element-plus/icons-vue';
import type { Line, Role } from '../../utils/db';

interface QueueItem {
  line: Line;
  index: number;
  chapterName: string;
}

const props = defineProps<{
  visible: boolean;
  queue: QueueItem[];
  roles: Role[];
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'retry', line: Line, index: number): void;
  (e: 'remove', lineId: number): void;
}>();

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});
</script>

<template>
  <div class="queue-dialog-wrapper">
    <el-dialog
      :model-value="dialogVisible"
      @update:modelValue="dialogVisible = $event"
      title="配音队列"
      width="600px"
      append-to-body
      class="custom-dialog"
    >
      <el-table :data="queue" style="width: 100%" max-height="400">
        <el-table-column prop="chapterName" label="章节" width="120" align="center" show-overflow-tooltip />
        <el-table-column label="序号" width="60" align="center">
          <template #default="scope">
            {{ scope.row.index + 1 }}
          </template>
        </el-table-column>
        <el-table-column prop="line.role_id" label="角色" align="center">
          <template #default="scope">
            {{ roles.find(r => r.id === scope.row.line.role_id)?.name || '未知角色' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="scope">
            <el-tag
              :type="scope.row.line.status === 2 ? 'warning' : (scope.row.line.status === 4 ? 'danger' : (scope.row.line.status === 1 ? 'info' : 'success'))"
              size="small"
            >
              {{ scope.row.line.status === 2 ? '生成中' : (scope.row.line.status === 4 ? '失败' : (scope.row.line.status === 1 ? '等待中' : '完成')) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="center">
          <template #default="scope">
            <div style="display: flex; gap: 8px; justify-content: center; align-items: center; min-height: 24px;">
              <el-tooltip v-if="scope.row.line.status === 4" content="再次尝试生成该条音频" placement="top">
                <el-button
                  type="primary"
                  size="small"
                  link
                  :icon="Refresh"
                  @click="emit('retry', scope.row.line, scope.row.index)"
                ></el-button>
              </el-tooltip>
              <el-tooltip content="将该任务从队列中移除" placement="top">
                <el-button
                  type="danger"
                  size="small"
                  link
                  :icon="Delete"
                  @click="emit('remove', scope.row.line.id)"
                ></el-button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">关闭</el-button>
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

:deep(.el-button+.el-button) {
  margin-left: 0;
}
</style>

