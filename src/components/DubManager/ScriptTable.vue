<script setup lang="ts">
import { computed } from 'vue';
import {
  Filter,
  VideoPlay,
  VideoPause,
  Refresh,
  Setting,
  Upload,
  WarningFilled,
  Delete,
  Top,
  Bottom,
} from '@element-plus/icons-vue';
import type { Line, Role } from '../../utils/db';

const props = defineProps<{
  lines: Line[];
  roles: Role[];
  selectedLineIds: Set<number>;
  currentPlayingKey: string;
  emotionUploadingLines: Set<number>;
}>();

const emit = defineEmits<{
  (e: 'toggleSelection', lineId: number): void;
  (e: 'selectAll'): void;
  (e: 'selectInverse'): void;
  (e: 'selectTodo'): void;
  (e: 'updateLine', line: Line): void;
  (e: 'generateLine', line: Line, index: number): void;
  (e: 'insertAbove', line: Line): void;
  (e: 'insertBelow', line: Line): void;
  (e: 'deleteLine', line: Line): void;
  (e: 'playAudio', path?: string, key?: string): void;
  (e: 'uploadEmoAudio', line: Line): void;
}>();

const tableColumns = [
  {
    key: 'selection',
    width: 40,
    align: 'center',
  },
  {
    key: 'id',
    title: '序号',
    dataKey: 'id',
    width: 80,
    align: 'center',
  },
  {
    key: 'role',
    title: '角色',
    dataKey: 'role_id',
    width: 120,
    align: 'center',
  },
  {
    key: 'text',
    title: '台词内容',
    dataKey: 'text',
    flexGrow: 1,
    width: 400,
    align: 'center',
  },
  {
    key: 'emotion_control',
    title: '情绪控制',
    width: 320,
    align: 'center',
  },
  {
    key: 'preview',
    title: '试听',
    width: 240,
    align: 'center',
  },
  {
    key: 'status',
    title: '状态',
    dataKey: 'status',
    width: 90,
    align: 'center',
  },
  {
    key: 'actions',
    title: '操作',
    width: 120,
    align: 'center',
  },
];

const getRowClass = ({ rowData }: { rowData: Line }) => {
  return `row-status-${rowData.status}`;
};

const hasSelection = computed(() => props.selectedLineIds.size > 0);
const isAllSelected = computed(
  () => props.lines.length > 0 && props.selectedLineIds.size === props.lines.length,
);
</script>

<template>
  <div class="script-editor">
    <el-auto-resizer>
      <template #default="{ height, width }">
        <el-table-v2
          :columns="tableColumns"
          :data="lines"
          :width="width"
          :height="height"
          :row-height="200"
          :row-class="getRowClass"
        >
          <template #header-cell="{ column }">
            <!-- 选择框表头：下拉选择 -->
            <div v-if="column.key === 'selection'" class="selection-header">
              <el-tooltip content="选择台词范围" placement="top">
                <el-dropdown trigger="click">
                  <el-icon
                    class="selection-icon"
                    :color="hasSelection ? '#409eff' : '#606266'"
                  >
                    <Filter />
                  </el-icon>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="emit('selectAll')">
                        {{ isAllSelected ? '取消全选' : '全选' }}
                      </el-dropdown-item>
                      <el-dropdown-item @click="emit('selectInverse')">反选</el-dropdown-item>
                      <el-dropdown-item divided @click="emit('selectTodo')">未生成/生成失败</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </el-tooltip>
            </div>
          </template>

          <template #cell="{ column, rowData, rowIndex }">
            <!-- 选择复选框 -->
            <template v-if="column.key === 'selection'">
              <el-checkbox
                :model-value="selectedLineIds.has(rowData.id)"
                @change="() => emit('toggleSelection', rowData.id)"
              />
            </template>

            <!-- 序号 -->
            <template v-else-if="column.key === 'id'">
              <span class="index-cell">{{
                String(rowIndex + 1).padStart(2, '0')
              }}</span>
            </template>

            <!-- 角色选择 -->
            <template v-else-if="column.key === 'role'">
              <el-select
                v-model="rowData.role_id"
                placeholder="选择角色"
                size="small"
                class="cell-select"
              >
                <el-option
                  v-for="r in roles"
                  :key="r.id"
                  :label="r.name"
                  :value="r.id"
                />
              </el-select>
            </template>

            <!-- 台词内容 -->
            <template v-else-if="column.key === 'text'">
              <el-input
                v-model="rowData.text"
                type="textarea"
                :rows="6"
                size="small"
                class="cell-input"
                @change="emit('updateLine', rowData)"
              />
            </template>

            <!-- 情绪控制 -->
            <template v-else-if="column.key === 'emotion_control'">
              <div class="emotion-control-cell">
                <!-- 第一行：方式选择 + 随机开关 + 高级设置 -->
                <div class="control-header-row">
                  <el-select
                    v-model="rowData.emo_control"
                    placeholder="合成模式"
                    size="small"
                    class="mode-select"
                    @change="() => {
                      emit('updateLine', rowData);
                    }"
                  >
                    <el-option label="角色配音情绪" value="0" />
                    <el-option label="情绪参考音频" value="1" />
                    <el-option label="自定义情绪向量" value="2" />
                    <el-option label="情绪描述" value="3" />
                    <el-option label="自动生成情绪向量" value="4" />
                  </el-select>
                  <el-tooltip v-if="['2','3','4'].includes(rowData.emo_control)" content="开启随机采样会降低音色的还原度。" placement="top">
                    <el-checkbox
                      v-model="rowData.use_random"
                      size="small"
                      label="随机采样"
                      class="random-toggle"
                      @change="emit('updateLine', rowData)"
                    />
                  </el-tooltip>
                  <el-popover placement="left-start" :width="380" trigger="click">
                    <template #reference>
                      <div>
                        <el-tooltip content="高级设置" placement="top">
                          <el-button size="small" :icon="Setting" class="advanced-btn" circle />
                        </el-tooltip>
                      </div>
                    </template>
                    <div class="advanced-settings-popover">
                      <div class="advanced-title">高级生成设置</div>
                      <el-form label-position="left" label-width="160px" size="small">
                        <el-form-item label="段间静音 (ms)" title="interval_silence">
                          <div class="setting-row">
                            <el-input-number v-model="rowData.interval_silence" :min="0" :step="100" @change="emit('updateLine', rowData)" />
                            <el-tooltip content="恢复默认值 (200)" placement="top">
                              <el-button link :icon="Refresh" @click="rowData.interval_silence = 200; emit('updateLine', rowData)" />
                            </el-tooltip>
                          </div>
                        </el-form-item>
                        <el-form-item label="是否采用采样" title="do_sample">
                          <div class="setting-row">
                            <el-switch v-model="rowData.do_sample" @change="emit('updateLine', rowData)" />
                            <el-tooltip content="恢复默认值 (true)" placement="top">
                              <el-button link :icon="Refresh" @click="rowData.do_sample = true; emit('updateLine', rowData)" />
                            </el-tooltip>
                          </div>
                        </el-form-item>
                        <el-form-item label="采样参数 temperature" title="temperature">
                          <div class="setting-row">
                            <el-input-number v-model="rowData.temperature" :min="0" :max="2" :step="0.01" @change="emit('updateLine', rowData)" />
                            <el-tooltip content="恢复默认值 (0.8)" placement="top">
                              <el-button link :icon="Refresh" @click="rowData.temperature = 0.8; emit('updateLine', rowData)" />
                            </el-tooltip>
                          </div>
                        </el-form-item>
                        <el-form-item label="采样参数 top_p" title="top_p">
                          <div class="setting-row">
                            <el-input-number v-model="rowData.top_p" :min="0" :max="1" :step="0.01" @change="emit('updateLine', rowData)" />
                            <el-tooltip content="恢复默认值 (0.8)" placement="top">
                              <el-button link :icon="Refresh" @click="rowData.top_p = 0.8; emit('updateLine', rowData)" />
                            </el-tooltip>
                          </div>
                        </el-form-item>
                        <el-form-item label="采样参数 top_k" title="top_k">
                          <div class="setting-row">
                            <el-input-number v-model="rowData.top_k" :min="0" :max="100" @change="emit('updateLine', rowData)" />
                            <el-tooltip content="恢复默认值 (30)" placement="top">
                              <el-button link :icon="Refresh" @click="rowData.top_k = 30; emit('updateLine', rowData)" />
                            </el-tooltip>
                          </div>
                        </el-form-item>
                        <el-form-item label="波束搜索大小" title="num_beams">
                          <div class="setting-row">
                            <el-input-number v-model="rowData.num_beams" :min="1" @change="emit('updateLine', rowData)" />
                            <el-tooltip content="恢复默认值 (3)" placement="top">
                              <el-button link :icon="Refresh" @click="rowData.num_beams = 3; emit('updateLine', rowData)" />
                            </el-tooltip>
                          </div>
                        </el-form-item>
                        <el-form-item label="重复惩罚" title="repetition_penalty">
                          <div class="setting-row">
                            <el-input-number v-model="rowData.repetition_penalty" :min="0.1" :max="20" :step="0.1" @change="emit('updateLine', rowData)" />
                            <el-tooltip content="恢复默认值 (10.0)" placement="top">
                              <el-button link :icon="Refresh" @click="rowData.repetition_penalty = 10.0; emit('updateLine', rowData)" />
                            </el-tooltip>
                          </div>
                        </el-form-item>
                        <el-form-item label="长度惩罚" title="length_penalty">
                          <div class="setting-row">
                            <el-input-number v-model="rowData.length_penalty" :min="0" :max="2" :step="0.1" @change="emit('updateLine', rowData)" />
                            <el-tooltip content="恢复默认值 (0.0)" placement="top">
                              <el-button link :icon="Refresh" @click="rowData.length_penalty = 0.0; emit('updateLine', rowData)" />
                            </el-tooltip>
                          </div>
                        </el-form-item>
                        <el-form-item label="最大生成token" title="max_mel_tokens">
                          <div class="setting-row">
                            <el-input-number v-model="rowData.max_mel_tokens" :min="50" :max="1815" :step="100" @change="emit('updateLine', rowData)" />
                            <el-tooltip content="恢复默认值 (1500)" placement="top">
                              <el-button link :icon="Refresh" @click="rowData.max_mel_tokens = 1500; emit('updateLine', rowData)" />
                            </el-tooltip>
                          </div>
                        </el-form-item>
                        <el-form-item label="单段最大生成token" title="max_text_tokens_per_segment">
                          <div class="setting-row">
                            <el-input-number v-model="rowData.max_text_tokens_per_segment" :min="20" :max="600" @change="emit('updateLine', rowData)" />
                            <el-tooltip content="恢复默认值 (120)" placement="top">
                              <el-button link :icon="Refresh" @click="rowData.max_text_tokens_per_segment = 120; emit('updateLine', rowData)" />
                            </el-tooltip>
                          </div>
                        </el-form-item>
                      </el-form>
                    </div>
                  </el-popover>
                </div>

                <!-- 第二行：具体参数输入 (仅当非角色模式时) -->
                <div v-if="!['0'].includes(rowData.emo_control)" class="control-body">
                  <!-- 情绪音频上传 (模式 1) -->
                  <div v-if="rowData.emo_control === '1'" class="detail-item audio-upload-group">
                    <template v-if="!rowData.emo_audio_prompt && !emotionUploadingLines.has(rowData.id)">
                        <el-tooltip content="上传参考音频文件" placement="top">
                          <el-button
                            type="primary"
                            size="small"
                            plain
                            class="upload-btn"
                            :icon="Upload"
                            @click="emit('uploadEmoAudio', rowData)"
                          >
                            上传音频
                          </el-button>
                        </el-tooltip>
                    </template>
                    <template v-else-if="emotionUploadingLines.has(rowData.id)">
                      <el-button type="primary" size="small" loading disabled plain class="upload-btn">
                        上传中...
                      </el-button>
                    </template>
                    <template v-else>
                      <div class="audio-action-row">
                        <el-tooltip :content="currentPlayingKey === 'line-emo-' + rowData.id ? '暂停' : '播放试听'" placement="top">
                          <el-button
                            :type="currentPlayingKey === 'line-emo-' + rowData.id ? 'warning' : 'success'"
                            size="small"
                            plain
                            class="play-btn"
                            :icon="currentPlayingKey === 'line-emo-' + rowData.id ? VideoPause : VideoPlay"
                            @click="emit('playAudio', rowData.local_emo_audio, 'line-emo-' + rowData.id)"
                          >
                            {{ currentPlayingKey === 'line-emo-' + rowData.id ? '暂停' : '试听' }}
                          </el-button>
                        </el-tooltip>
                        <el-tooltip content="更换参考音频" placement="top">
                          <el-button
                            type="info"
                            size="small"
                            plain
                            class="reupload-btn"
                            :icon="Refresh"
                            @click="emit('uploadEmoAudio', rowData)"
                          >
                            重传
                          </el-button>
                        </el-tooltip>
                      </div>
                    </template>
                  </div>

                  <!-- 情绪向量弹出层 (模式 2) -->
                  <div v-if="rowData.emo_control === '2'" class="detail-item">
                    <el-popover placement="bottom" :width="300" trigger="click">
                      <template #reference>
                        <el-button size="small" type="primary" plain class="full-width-btn">
                          设置 8 维情绪向量
                        </el-button>
                      </template>
                      <div class="vec-popover-content">
                          <div
                            v-for="emo in [
                              { key: 'happy', label: '高兴' },
                              { key: 'angry', label: '愤怒' },
                              { key: 'sad', label: '悲伤' },
                              { key: 'afraid', label: '恐惧' },
                              { key: 'disgusted', label: '反感' },
                              { key: 'melancholic', label: '低落' },
                              { key: 'surprised', label: '惊讶' },
                              { key: 'calm', label: '自然' }
                            ]"
                            :key="emo.key"
                            class="vec-slider-item"
                          >
                          <span class="vec-label">{{ emo.label }}</span>
                          <el-slider
                            v-model="rowData[emo.key]"
                            :min="0"
                            :max="1.0"
                            :step="0.01"
                            size="small"
                            @change="emit('updateLine', rowData)"
                          />
                        </div>
                      </div>
                    </el-popover>
                  </div>

                  <!-- 情绪描述文本 (模式 3) -->
                  <div v-if="rowData.emo_control === '3'" class="detail-item">
                    <el-input
                      v-model="rowData.emo_text"
                      placeholder="输入描述，如：开心地，愤怒地"
                      size="small"
                      clearable
                      @change="emit('updateLine', rowData)"
                    />
                  </div>

                  <!-- 权重控制 (音频和文字模式共用) -->
                  <div v-if="['1','3','4'].includes(rowData.emo_control)" class="intensity-slider">
                    <span class="intensity-label">情绪权重</span>
                    <el-slider
                      v-model="rowData.emo_alpha"
                      :min="0"
                      :max="1.0"
                      :step="0.01"
                      size="small"
                      @change="emit('updateLine', rowData)"
                    />
                  </div>
                </div>
              </div>
            </template>

            <!-- 试听生成音频 -->
            <template v-else-if="column.key === 'preview'">
              <el-tooltip
                v-if="rowData.gen_audio"
                :content="currentPlayingKey === 'line-gen-' + rowData.id ? '停止播放' : '点击试听合成音频'"
                placement="top"
              >
                <el-button
                  link
                  size="small"
                  type="success"
                  :icon="currentPlayingKey === 'line-gen-' + rowData.id ? VideoPause : VideoPlay"
                  @click="emit('playAudio', rowData.gen_audio, 'line-gen-' + rowData.id)"
                >
                  {{ currentPlayingKey === 'line-gen-' + rowData.id ? '暂停' : '试听' }}
                </el-button>
              </el-tooltip>
              <span v-else class="status-todo">-</span>
            </template>

            <!-- 生成状态 -->
            <template v-else-if="column.key === 'status'">
              <div v-if="rowData.status === 3" class="status-done">
                <span class="dot"></span> 已完成
              </div>
              <div
                v-else-if="rowData.status === 2"
                class="status-running"
              >
                <el-progress :percentage="80" :show-text="false" status="warning" />
                <span>正在生成</span>
              </div>
              <div
                v-else-if="rowData.status === 1"
                class="status-waiting"
              >
                <span class="dot waiting-dot"></span> 等待中
              </div>
              <div
                v-else-if="rowData.status === 4"
                class="status-failed"
              >
                <el-tooltip :content="rowData.error_msg || '生成失败'" placement="top">
                  <div class="failed-label">
                    <el-icon color="#f56c6c"><WarningFilled /></el-icon> 失败
                  </div>
                </el-tooltip>
              </div>
              <div v-else class="status-todo">未生成</div>
            </template>

            <!-- 操作按钮 -->
            <template v-else-if="column.key === 'actions'">
              <div class="cell-actions-vertical">
                <el-tooltip :content="rowData.status === 3 || rowData.status === 4 ? '点击以重新生成音频' : '开始合成该条台词'" placement="top">
                  <el-button
                    type="primary"
                    size="small"
                    :icon="rowData.status === 3 || rowData.status === 4 ? Refresh : VideoPlay"
                    :loading="rowData.status === 1 || rowData.status === 2"
                    @click="emit('generateLine', rowData, rowIndex)"
                    class="action-btn-v"
                  >
                    {{ rowData.status === 3 || rowData.status === 4 ? '重新生成' : '生成' }}
                  </el-button>
                </el-tooltip>
                <el-tooltip content="在当前台词上方插入一行" placement="top">
                  <el-button type="success" size="small" :icon="Top" plain @click="emit('insertAbove', rowData)" class="action-btn-v">向上插入</el-button>
                </el-tooltip>
                <el-tooltip content="在当前台词下方插入一行" placement="top">
                  <el-button type="success" size="small" :icon="Bottom" plain @click="emit('insertBelow', rowData)" class="action-btn-v">向下插入</el-button>
                </el-tooltip>
                <el-popconfirm title="确定删除这条台词吗？" @confirm="emit('deleteLine', rowData)">
                  <template #reference>
                    <div>
                      <el-tooltip content="彻底移除该条台词" placement="top">
                        <el-button type="danger" size="small" :icon="Delete" class="action-btn-v">删除</el-button>
                      </el-tooltip>
                    </div>
                  </template>
                </el-popconfirm>
              </div>
            </template>
          </template>
        </el-table-v2>
      </template>
    </el-auto-resizer>
  </div>
</template>

<style scoped>
:deep(.el-table-v2__row.row-status-0) {
  background-color: #ffffff;
}
:deep(.el-table-v2__row.row-status-1) {
  background-color: #f0f9ff;
}
:deep(.el-table-v2__row.row-status-2) {
  background-color: #fffbeb;
}
:deep(.el-table-v2__row.row-status-3) {
  background-color: #f0fdf4;
}
:deep(.el-table-v2__row.row-status-4) {
  background-color: #fff1f0;
  border-left: 4px solid #f5222d;
}

.header-renderer {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
}

.selection-header {
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  width: 100%;
  height: 100%;
}

.cell-actions-vertical {
  display: flex;
  flex-direction: column;
  gap: 4px;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.action-btn-v {
  width: 90px;
  margin-left: 0 !important;
}

.cell-actions-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.action-row {
  display: flex;
  justify-content: center;
  gap: 8px;
  width: 100%;
}

.action-btn {
  flex: 1;
  padding: 8px 12px;
}

.script-editor {
  background-color: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  flex: 1;
  min-height: 400px;
}

.script-table :deep(.el-table__header) th,
:deep(.el-table-v2__header),
:deep(.el-table-v2__header-cell) {
  background-color: #f8fafc;
  color: #64748b;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid #e2e8f0;
}

:deep(.el-table-v2__row-cell) {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #f1f5f9;
}

.index-cell {
  font-size: 13px;
  color: #94a3b8;
  font-family: monospace;
}

.cell-select {
  width: 100%;
}

.cell-input {
  width: 100%;
}

:deep(.cell-input .el-textarea__inner) {
  padding: 4px 8px;
  font-size: 13px;
  line-height: 1.4;
  resize: none;
}

.cell-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}

.status-done {
  color: #10b981;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-done .dot {
  width: 6px;
  height: 6px;
  background-color: #10b981;
  border-radius: 50%;
}

.status-waiting {
  color: #64748b;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-waiting .dot.waiting-dot {
  width: 6px;
  height: 6px;
  background-color: #94a3b8;
  border-radius: 50%;
}

/* Emotion Control Cell Styles */
.emotion-control-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 4px;
  width: 100%;
}

.control-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mode-select {
  flex: 1;
}

.random-toggle {
  margin: 0;
  color: #94a3b8;
  font-size: 12px;
}

.advanced-btn {
  color: #64748b;
  border-color: #e2e8f0;
}

.advanced-btn:hover {
  color: #3b82f6;
  border-color: #bfdbfe;
  background-color: #eff6ff;
}

.advanced-settings-popover {
  padding: 8px;
}

.advanced-title {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e2e8f0;
}

.advanced-settings-popover :deep(.el-form-item) {
  margin-bottom: 12px;
}

.advanced-settings-popover :deep(.el-form-item__label) {
  font-size: 13px;
  color: #64748b;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.setting-row :deep(.el-input-number) {
  width: 130px;
}

.setting-row .el-button {
  color: #94a3b8;
}

.setting-row .el-button:hover {
  color: #3b82f6;
}

.control-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  background-color: #f8fafc;
  border-radius: 6px;
  border: 1px solid #eef2f6;
}

.full-width-btn {
  width: 100%;
}

.audio-upload-group {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 0;
}

.audio-upload-group .upload-btn {
  width: 100%;
  height: 32px;
}

.audio-action-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.audio-action-row .play-btn {
  flex: 1;
}

.audio-action-row .reupload-btn {
  flex: 0 0 auto;
}

.intensity-slider {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
}

.intensity-label {
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
  width: 50px;
}

.intensity-slider :deep(.el-slider) {
  flex: 1;
}

.vec-popover-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px;
}

.vec-slider-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.vec-label {
  width: 40px;
  font-size: 12px;
  color: #64748b;
  text-align: right;
}

.vec-slider-item :deep(.el-slider) {
  flex: 1;
}

.status-running :deep(.el-progress) {
  flex: 1;
}

.status-failed {
  color: #f56c6c;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.failed-label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: help;
}

.status-todo {
  color: #94a3b8;
  font-size: 13px;
}
</style>
