<script setup lang="ts">
import { computed } from 'vue';
import { Search, Plus, VideoPlay, VideoPause, EditPen, Delete } from '@element-plus/icons-vue';
import type { Role } from '../../utils/db';

const props = defineProps<{
  visible: boolean;
  roles: Role[];
  filteredRoles: Role[];
  roleSearchQuery: string;
  currentPlayingKey: string;
  getDubberName: (id?: number) => string;
  getDubberAudio: (id?: number) => string;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'update:roleSearchQuery', value: string): void;
  (e: 'add'): void;
  (e: 'edit', role: Role): void;
  (e: 'delete', role: Role): void;
  (e: 'playAudio', path?: string, key?: string): void;
}>();

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const searchProxy = computed({
  get: () => props.roleSearchQuery,
  set: (value) => emit('update:roleSearchQuery', value),
});
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="角色库"
    width="850px"
    style="height: 600px"
    append-to-body
    class="custom-dialog"
  >
    <div class="role-list-header">
      <el-input
        v-model="searchProxy"
        placeholder="搜索角色名称"
        :prefix-icon="Search"
        clearable
        style="width: 240px"
      />
      <el-button type="primary" :icon="Plus" @click="emit('add')"
        >新增角色</el-button
      >
    </div>

    <el-scrollbar max-height="450px">
      <div class="role-grid-container">
        <div class="character-grid">
          <div
            v-for="role in filteredRoles"
            :key="role.id"
            class="character-card"
          >
            <div class="card-info" @click="emit('edit', role)">
              <el-avatar
                :size="40"
                src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png"
              />
              <div class="role-meta">
                <div class="role-name">{{ role.name }}</div>
                <div class="role-intro">
                  {{ getDubberName(role.dubber_id) }}
                </div>
              </div>
            </div>
            <div class="card-actions">
                <el-tooltip v-if="role.dubber_id" :content="currentPlayingKey === 'role-' + role.id ? '停止试听' : '播放角色示范音频'" placement="top">
                  <el-button
                    class="trial-btn"
                    link
                    size="small"
                    :icon="
                      currentPlayingKey === 'role-' + role.id
                        ? VideoPause
                        : VideoPlay
                    "
                    @click.stop="emit('playAudio', getDubberAudio(role.dubber_id), 'role-' + role.id)"
                    >{{
                      currentPlayingKey === 'role-' + role.id
                        ? '暂停'
                        : '试听'
                    }}</el-button
                  >
                </el-tooltip>
                <div class="btn-group">
                  <el-tooltip content="编辑角色基本信息" placement="top">
                    <el-button
                      link
                      size="small"
                      :icon="EditPen"
                      @click="emit('edit', role)"
                      >编辑</el-button
                    >
                  </el-tooltip>
                  <el-popconfirm
                    title="确定移除该角色吗？"
                    @confirm="emit('delete', role)"
                  >
                    <template #reference>
                      <el-tooltip content="将该角色从库中删除" placement="top">
                        <el-button link size="small" type="danger" :icon="Delete"
                          >删除</el-button
                        >
                      </el-tooltip>
                    </template>
                  </el-popconfirm>
                </div>
            </div>
          </div>
        </div>
      </div>
    </el-scrollbar>
  </el-dialog>
</template>

<style scoped>
.role-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.role-grid-container {
  padding-right: 12px;
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.character-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s;
  background-color: #ffffff;
}

.character-card:hover {
  border-color: #5e72e4;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.card-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  cursor: pointer;
}

.role-meta {
  flex: 1;
  overflow: hidden;
}

.role-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.role-intro {
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}

.trial-btn {
  font-size: 12px;
  color: #5e72e4;
}

.btn-group {
  display: flex;
  gap: 4px;
}

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
</style>
