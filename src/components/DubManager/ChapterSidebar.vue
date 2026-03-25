<script setup lang="ts">
import { computed } from 'vue';
import {
  Search,
  Plus,
  List,
  EditPen,
  Delete,
  Expand,
  Fold,
} from '@element-plus/icons-vue';
import type { Chapter } from '../../utils/db';

const props = defineProps<{
  collapsed: boolean;
  searchQuery: string;
  chapters: Chapter[];
  currentChapterId: number | null;
}>();

const emit = defineEmits<{
  (e: 'update:collapsed', value: boolean): void;
  (e: 'update:searchQuery', value: string): void;
  (e: 'select', chapter: Chapter): void;
  (e: 'add'): void;
  (e: 'edit', chapter: Chapter): void;
  (e: 'delete', chapter: Chapter): void;
}>();

const collapsedProxy = computed({
  get: () => props.collapsed,
  set: (value) => emit('update:collapsed', value),
});

const searchProxy = computed({
  get: () => props.searchQuery,
  set: (value) => emit('update:searchQuery', value),
});
</script>

<template>
  <div :class="['chapter-sidebar', { 'is-collapsed': collapsedProxy }]">
    <div class="sidebar-header">
      <div class="header-top">
        <el-input
          v-if="!collapsedProxy"
          v-model="searchProxy"
          placeholder="搜索章节"
          :prefix-icon="Search"
          clearable
          size="small"
        />
        <el-tooltip :content="collapsedProxy ? '展开侧边栏' : '折叠侧边栏'" placement="right">
          <el-button
            link
            class="toggle-btn"
            :icon="collapsedProxy ? Expand : Fold"
            @click="collapsedProxy = !collapsedProxy"
          ></el-button>
        </el-tooltip>
      </div>
      <div class="chapter-actions" v-if="!collapsedProxy">
        <span class="chapter-count">章节列表 ({{ chapters.length }})</span>
        <div class="action-btns">
          <el-tooltip content="新增章节" placement="top">
            <el-button link :icon="Plus" @click="emit('add')"></el-button>
          </el-tooltip>
        </div>
      </div>
      <div class="collapsed-actions" v-else>
        <el-tooltip content="新增章节" placement="right">
          <el-button link :icon="Plus" @click="emit('add')"></el-button>
        </el-tooltip>
      </div>
    </div>

    <el-scrollbar class="chapter-scrollbar">
      <div class="chapter-list">
        <div
          v-for="(chapter, index) in chapters"
          :key="chapter.id"
          :class="['chapter-item', { active: currentChapterId === chapter.id }]"
          @click="emit('select', chapter)"
        >
          <el-tooltip
            :content="chapter.name"
            placement="right"
            :disabled="!collapsedProxy"
          >
            <div class="chapter-info">
              <div class="chapter-icon" v-if="collapsedProxy">
                {{ index + 1 }}
              </div>
              <el-icon v-else><List /></el-icon>
              <span class="chapter-name" v-if="!collapsedProxy">{{
                chapter.name
              }}</span>
            </div>
          </el-tooltip>
          <div class="chapter-item-actions" v-if="!collapsedProxy">
            <el-tooltip content="编辑章节" placement="top">
              <el-button
                link
                :icon="EditPen"
                @click.stop="emit('edit', chapter)"
              ></el-button>
            </el-tooltip>
            <el-tooltip content="删除章节" placement="top">
              <el-button
                link
                :icon="Delete"
                class="delete-chapter-btn"
                @click.stop="emit('delete', chapter)"
              ></el-button>
            </el-tooltip>
          </div>
        </div>
      </div>
    </el-scrollbar>
  </div>
</template>

<style scoped>
.chapter-sidebar {
  width: 260px;
  background-color: #ffffff;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.chapter-sidebar.is-collapsed {
  width: 64px;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #f1f5f9;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.toggle-btn {
  padding: 8px;
  font-size: 18px;
  color: #64748b;
}

.collapsed-actions {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}

.chapter-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
}

.chapter-count {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
}

.chapter-scrollbar {
  flex: 1;
  overflow: hidden;
}

.chapter-list {
  padding: 10px 0;
}

.chapter-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 20px;
  height: 48px;
  cursor: pointer;
  transition: all 0.2s;
  color: #475569;
  position: relative;
}

.chapter-item:hover {
  background-color: #f1f5f9;
}

.chapter-item.active {
  background-color: #eff6ff;
  color: #2563eb;
  border-right: 3px solid #2563eb;
}

.chapter-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  overflow: hidden;
}

.chapter-name {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chapter-icon {
  width: 24px;
  height: 24px;
  background-color: #f1f5f9;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  flex-shrink: 0;
}

.active .chapter-icon {
  background-color: #2563eb;
  color: #ffffff;
}

.is-collapsed .chapter-item {
  justify-content: center;
  padding: 0;
}

.is-collapsed .chapter-info {
  justify-content: center;
  gap: 0;
}

.chapter-item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.2s, visibility 0.2s;
}

.chapter-item:hover .chapter-item-actions {
  visibility: visible;
  opacity: 1;
}

.chapter-item-actions .el-button {
  padding: 4px;
  height: 24px;
  color: #94a3b8;
}

.chapter-item-actions .el-button:hover {
  color: #5e72e4;
}

.chapter-item-actions .delete-chapter-btn:hover {
  color: #f5365c;
}
</style>
