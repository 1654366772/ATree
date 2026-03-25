<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Setting, Download, Upload } from '@element-plus/icons-vue';
import { initDB } from '../utils/db';

const isExporting = ref(false);
const isImporting = ref(false);

const handleExport = async () => {
  isExporting.value = true;
  try {
    const db = await initDB();
    const storeNames = ['article', 'chapter', 'role', 'line', 'dubber', 'prompt', 'ai_model', 'tag'];
    const exportData: Record<string, any[]> = {};

    for (const storeName of storeNames) {
      exportData[storeName] = await db.getAll(storeName as any);
    }

    const filePath = await (window as any).ipcRenderer.invoke('dialog:saveFile', {
      title: '导出数据库数据',
      defaultPath: `atree_backup_${new Date().toISOString().split('T')[0]}.json`,
      filters: [{ name: 'JSON 数据文件', extensions: ['json'] }]
    });

    if (filePath) {
      const jsonContent = JSON.stringify(exportData, null, 2);
      const result = await (window as any).ipcRenderer.invoke('fs:writeFile', {
        filePath,
        content: jsonContent
      });

      if (result.success) {
        ElMessage.success('数据库记录导出成功');
      } else {
        throw new Error(result.error);
      }
    }
  } catch (error: any) {
    console.error('Export Error:', error);
    ElMessage.error('导出失败：' + error.message);
  } finally {
    isExporting.value = false;
  }
};

const handleImport = async () => {
  try {
    const filePath = await (window as any).ipcRenderer.invoke('dialog:openFile', {
      title: '选择要导入的数据库文件',
      filters: [{ name: 'JSON 数据文件', extensions: ['json'] }]
    });

    if (!filePath) return;

    await ElMessageBox.confirm(
      '导入数据将清空当前数据库中的对应表，建议在导入前先导出备份。是否继续？',
      '风险提示',
      {
        confirmButtonText: '确定导入',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    isImporting.value = true;
    const readResult = await (window as any).ipcRenderer.invoke('fs:readFile', { filePath });

    if (!readResult.success) {
      throw new Error(readResult.error);
    }

    const importData = JSON.parse(readResult.content);
    const db = await initDB();
    const storeNames = ['article', 'chapter', 'role', 'line', 'dubber', 'prompt', 'ai_model', 'tag'];

    for (const storeName of storeNames) {
      if (importData[storeName]) {
        // 清空原表
        await db.clear(storeName as any);
        // 批量写入新数据
        const items = importData[storeName];
        const tx = db.transaction(storeName as any, 'readwrite');
        for (const item of items) {
          await tx.store.put(item);
        }
        await tx.done;
      }
    }

    ElMessage.success('数据库数据导入成功，建议刷新页面以同步状态');
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('Import Error:', error);
      ElMessage.error('导入失败：' + error.message);
    }
  } finally {
    isImporting.value = false;
  }
};
</script>

<template>
  <div class="settings-container">
    <div class="settings-header">
      <div class="header-title">
        <el-icon class="title-icon"><Setting /></el-icon>
        <span>系统设置</span>
      </div>
      <div class="header-desc">管理数据库备份与数据迁移</div>
    </div>

    <div class="settings-content">
      <el-card class="settings-card" shadow="never">
        <div class="card-header">
          <div class="card-title">数据备份与恢复</div>
          <div class="card-desc">导出完整的数据库记录为 JSON 文件，或从备份文件中恢复数据。</div>
        </div>

        <div class="action-list">
          <div class="action-item">
            <div class="action-info">
              <div class="action-name">导出数据库数据</div>
              <div class="action-desc">将所有的文章、台词、角色、配音员及设置导出为文件。</div>
            </div>
            <el-button 
              type="primary" 
              :icon="Download" 
              @click="handleExport" 
              :loading="isExporting"
            >
              导出备份
            </el-button>
          </div>

          <el-divider />

          <div class="action-item">
            <div class="action-info">
              <div class="action-name">导入数据库数据</div>
              <div class="action-desc">从 JSON 备份文件中恢复数据。请注意：这会替换当前数据库内容。</div>
            </div>
            <el-button 
              type="warning" 
              plain 
              :icon="Upload" 
              @click="handleImport" 
              :loading="isImporting"
            >
              导入备份
            </el-button>
          </div>
        </div>
      </el-card>

      <el-card class="settings-card info-card" shadow="never">
        <template #header>
          <div class="info-header">
            <el-icon><WarningFilled /></el-icon>
            <span>注意事项</span>
          </div>
        </template>
        <ul class="info-list">
          <li>导出的文件包含应用内所有的文本配置信息。</li>
          <li>导入操作是覆盖性的，执行前请务必确认已经备份现有重要数据。</li>
          <li>如果导入数据后界面没有即时更新，请尝试重新启动应用。</li>
        </ul>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.settings-container {
  padding: 32px;
  max-width: 1000px;
  margin: 0 auto;
}

.settings-header {
  margin-bottom: 32px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 8px;
}

.title-icon {
  color: #5e72e4;
}

.header-desc {
  font-size: 14px;
  color: #64748b;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.card-header {
  margin-bottom: 24px;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4px;
}

.card-desc {
  font-size: 14px;
  color: #64748b;
}

.action-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
}

.action-name {
  font-size: 16px;
  font-weight: 500;
  color: #1e293b;
  margin-bottom: 4px;
}

.action-desc {
  font-size: 13px;
  color: #94a3b8;
}

.info-card {
  background-color: #f8fafc;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #e6a23c;
  font-weight: 600;
}

.info-list {
  padding-left: 20px;
  margin: 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.8;
}

:deep(.el-divider--horizontal) {
  margin: 20px 0;
}
</style>
