<script setup lang="ts">
import { VideoPlay, VideoPause } from '@element-plus/icons-vue';
import type { VoiceActor } from '../../utils/db';

interface Dubber extends VoiceActor {
  _tagSet?: Set<string>;
}

const props = defineProps<{
  actors: Dubber[];
  currentPlayingKey: string;
  getTagStyle: (tag: string) => Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'playAudio', path?: string, key?: string): void;
  (e: 'edit', actor: Dubber): void;
  (e: 'delete', actor: Dubber): void;
}>();
</script>

<template>
  <el-scrollbar class="actor-scrollbar">
    <div v-if="actors.length === 0" class="empty-state">
      <el-empty description="暂无配音员数据" />
    </div>
    <div v-else class="actor-grid">
      <div
        v-for="actor in actors"
        :key="actor.id"
        class="actor-card"
      >
        <div class="card-main" @click="emit('edit', actor)">
          <div class="card-header">
            <span class="actor-id-name">{{ actor.name }}</span>
            <el-button
              circle
              link
              class="play-btn"
              @click.stop="emit('playAudio', actor.audio_path, 'actor-' + actor.id)"
              :class="{ 'is-playing': currentPlayingKey === 'actor-' + actor.id }"
            >
              <el-icon :size="20">
                <component
                  :is="
                    currentPlayingKey === 'actor-' + actor.id
                      ? VideoPause
                      : VideoPlay
                  "
                />
              </el-icon>
            </el-button>
          </div>

          <div class="tags-container">
            <el-tag
              v-for="tag in actor.tags.split(',').filter((t) => t)"
              :key="tag"
              size="small"
              round
              :style="getTagStyle(tag)"
              effect="dark"
              class="actor-tag"
            >
              {{ tag }}
            </el-tag>
          </div>

          <div class="audio-path-text" :title="actor.audio_path">
            {{ actor.audio_path || '未设置音频文件' }}
          </div>
        </div>

        <div class="card-footer">
          <el-button
            link
            type="primary"
            size="small"
            @click.stop="emit('edit', actor)"
            >编辑</el-button
          >
          <el-button
            link
            type="danger"
            size="small"
            @click.stop="emit('delete', actor)"
            >删除</el-button
          >
        </div>
      </div>
    </div>
  </el-scrollbar>
</template>

<style scoped>
.actor-scrollbar {
  flex: 1;
  overflow: hidden;
}

.actor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  padding: 4px;
  padding-bottom: 20px;
}

.actor-card {
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  min-height: 160px;
}

.card-main {
  cursor: pointer;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.actor-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: #e4e7ed;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.actor-id-name {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.play-btn {
  color: #64748b;
  transition: color 0.2s;
}

.play-btn:hover,
.play-btn.is-playing {
  color: #2563eb;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
  min-height: 24px;
}

.actor-tag {
  border: none;
  font-weight: 500;
}

.audio-path-text {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: #f8fafc;
  padding: 6px 10px;
  border-radius: 6px;
}

.card-footer {
  display: flex;
  justify-content: flex-start;
  gap: 16px;
  margin-top: auto;
  border-top: 1px solid #f1f5f9;
  padding-top: 12px;
}

.empty-state {
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
