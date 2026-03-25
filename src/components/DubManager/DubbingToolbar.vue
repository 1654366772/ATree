<script setup lang="ts">
import { computed } from 'vue';
import { MagicStick, Upload, User, Plus, VideoCamera, Film } from '@element-plus/icons-vue';

const props = defineProps<{
  isParsing: boolean;
  autoPlay: boolean;
}>();

const emit = defineEmits<{
  (e: 'parse'): void;
  (e: 'batchGenerate'): void;
  (e: 'openRoleList'): void;
  (e: 'insertFirst'): void;
  (e: 'openPrExport'): void;
  (e: 'openJianyingExport'): void;
  (e: 'update:autoPlay', value: boolean): void;
}>();

const autoPlayProxy = computed({
  get: () => props.autoPlay,
  set: (value) => emit('update:autoPlay', value),
});
</script>

<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <el-tooltip content="根据正文内容自动解析角色与台词" placement="top">
        <el-button
          type="primary"
          :icon="MagicStick"
          :loading="isParsing"
          @click="emit('parse')"
          >解析台词</el-button
        >
      </el-tooltip>
      <el-tooltip content="批量生成选中的台词音频" placement="top">
        <el-button
          type="primary"
          plain
          :icon="Upload"
          @click="emit('batchGenerate')"
          >批量生成</el-button
        >
      </el-tooltip>
      <el-tooltip content="生成Premiere Pro剪辑工程(PR)" placement="top">
        <el-button
          type="warning"
          plain
          :icon="VideoCamera"
          @click="emit('openPrExport')"
          >生成PR工程</el-button
        >
      </el-tooltip>
      <el-tooltip content="生成剪映草稿" placement="top">
        <el-button
          type="danger"
          plain
          :icon="Film"
          @click="emit('openJianyingExport')"
          >生成剪映草稿</el-button
        >
      </el-tooltip>
      <el-tooltip content="管理当前项目的角色与配音员" placement="top">
        <el-button
          type="info"
          plain
          :icon="User"
          @click="emit('openRoleList')"
          >角色库</el-button
        >
      </el-tooltip>
    </div>
    <div class="toolbar-right">
      <el-tooltip content="在列表顶端插入一行新台词" placement="top">
        <el-button
          type="success"
          plain
          :icon="Plus"
          @click="emit('insertFirst')"
          >首行插入</el-button
        >
      </el-tooltip>
      <!-- 占位间距 -->
      <div style="width: 10px;"></div>
      <el-tooltip content="开启后，播放时会自动播放下一条台词" placement="top">
        <div class="play-control">
          <span>顺序播放</span>
          <el-switch v-model="autoPlayProxy" />
        </div>
      </el-tooltip>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  background-color: #ffffff;
  border-radius: 12px;
  padding: 16px 24px;
  margin-bottom: 24px;
  border: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.play-control {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #64748b;
}
</style>
