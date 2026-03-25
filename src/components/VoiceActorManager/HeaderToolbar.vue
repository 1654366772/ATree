<script setup lang="ts">
import { computed } from 'vue';
import { Search, Plus } from '@element-plus/icons-vue';
import type { Tag } from '../../utils/db';

const props = defineProps<{
  selectedTags: string[];
  voiceTags: Tag[];
  searchQuery: string;
  getTagStyle: (tag: string, selected?: boolean) => Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'update:selectedTags', value: string[]): void;
  (e: 'update:searchQuery', value: string): void;
  (e: 'search'): void;
  (e: 'openAdd'): void;
}>();

const selectedTagsProxy = computed({
  get: () => props.selectedTags,
  set: (value) => emit('update:selectedTags', value),
});

const searchQueryProxy = computed({
  get: () => props.searchQuery,
  set: (value) => emit('update:searchQuery', value),
});

const removeSelectedTag = (tag: string) => {
  emit(
    'update:selectedTags',
    props.selectedTags.filter((t) => t !== tag),
  );
  emit('search');
};
</script>

<template>
  <div class="header-toolbar">
    <el-button type="primary" class="add-btn" @click="emit('openAdd')">
      <el-icon>
        <Plus />
      </el-icon>
      新增配音员
    </el-button>
    <div class="filter-controls">
      <div class="tag-filter">
        <el-select
          v-model="selectedTagsProxy"
          multiple
          filterable
          collapse-tags
          collapse-tags-indicator
          placeholder="筛选标签"
          @change="emit('search')"
        >
          <template #tag>
            <el-tag
              v-for="tag in selectedTagsProxy"
              :key="tag"
              size="small"
              round
              :style="getTagStyle(tag)"
              closable
              @close="removeSelectedTag(tag)"
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
              :style="getTagStyle(tag.value, selectedTagsProxy.includes(tag.value))"
            >
              {{ tag.value }}
            </el-tag>
          </el-option>
        </el-select>
      </div>

      <div class="search-box">
        <el-input
          v-model="searchQueryProxy"
          placeholder="搜索配音员名称"
          :prefix-icon="Search"
          clearable
          @input="emit('search')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.header-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: white;
  padding: 16px 24px;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  margin-bottom: 24px;
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
  flex-shrink: 0;
}

.filter-controls {
  display: flex;
  gap: 12px;
  align-items: center;
  flex: 1;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.tag-filter {
  flex: 1;
  max-width: 300px;
  min-width: 150px;
}

.search-box {
  flex: 1;
  max-width: 280px;
  min-width: 150px;
}

:deep(.el-input__wrapper),
:deep(.el-select__wrapper) {
  border-radius: 8px;
  background-color: #f5f7fa;
  box-shadow: none !important;
  border: 1px solid #e4e7ed;
}

:deep(.el-input__wrapper.is-focus),
:deep(.el-select__wrapper.is-focused) {
  border-color: #5e72e4;
  background-color: white;
}
</style>
