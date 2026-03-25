<script setup lang="ts">
import { ArrowLeft, Setting, Promotion } from '@element-plus/icons-vue';

const props = defineProps<{
  articleName: string;
  chapterName: string;
  queueCount: number;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'openSettings'): void;
  (e: 'openQueue'): void;
  (e: 'openFolder'): void;
}>();
</script>

<template>
  <div class="content-header">
    <div class="header-left">
      <el-tooltip content="返回项目列表" placement="bottom">
        <el-button link :icon="ArrowLeft" @click="emit('back')">返回</el-button>
      </el-tooltip>
      <div class="divider"></div>
      <h2 class="article-title">
        {{ articleName }} - {{ chapterName }}
      </h2>
    </div>
    <div class="header-right">
      <el-tooltip content="修改文章全局配置" placement="bottom">
        <el-button link :icon="Setting" @click="emit('openSettings')"
          >文章设置</el-button
        >
      </el-tooltip>
      <el-tooltip content="查看配音进度队列" placement="bottom">
        <el-button link :icon="Promotion" @click="emit('openQueue')"
          >配音队列
          <el-badge
            v-if="queueCount > 0"
            :value="queueCount"
            class="task-badge"
          />
        </el-button>
      </el-tooltip>
      <el-tooltip content="在资源管理器中打开当前章节音频存放目录" placement="bottom">
        <el-button type="primary" class="publish-btn" @click="emit('openFolder')"
          >打开配音文件夹</el-button
        >
      </el-tooltip>
    </div>
  </div>
</template>

<style scoped>
.content-header {
  height: 64px;
  background-color: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.divider {
  width: 1px;
  height: 20px;
  background-color: #e2e8f0;
}

.article-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.publish-btn {
  background-color: #5e72e4;
  border-color: #5e72e4;
}

.task-badge :deep(.el-badge__content) {
  background-color: #eff6ff;
  color: #2563eb;
  border: 1px solid #dbeafe;
}
</style>
