<script setup lang="ts">
import {
  Document,
  User,
  ChatDotRound,
  Cpu,
  Fold,
  Expand,
  Sunny,
  Moon,
  Setting
} from '@element-plus/icons-vue';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useDark, useToggle } from '@vueuse/core';
import logo from '../assets/logo.svg'; // 使用现有资源作为 Logo 占位符

const isCollapse = ref(false); // 修改默认为 false，以便默认显示菜单
const router = useRouter();

const isDark = useDark({
  // 存储到localStorage/sessionStorage中的Key 根据自己的需求更改
  storageKey: 'useDarkKEY',
  // 暗黑class名字
  valueDark: 'dark',
  // 高亮class名字
  valueLight: 'light',
});
const toggleDark = useToggle(isDark);

// 移除对不存在的getAll方法的调用
</script>

<template>
  <el-container style="height: 100%">
    <el-aside width="auto">
      <el-menu
        default-active="/article"
        class="menu"
        :collapse="isCollapse"
        collapse-transition
        :router="true"
      >
        <!-- Logo 区域 -->
        <div class="logo-wrapper">
          <div class="logo-container">
            <img :src="logo" alt="logo" class="logo-img" />
            <div class="logo-text" v-show="!isCollapse">
              <span class="app-name">ATree</span>
              <span class="app-version">Windows版</span>
            </div>
          </div>
        </div>

        <el-menu-item index="/article">
          <el-icon>
            <Document />
          </el-icon>
          <template #title>文章管理</template>
        </el-menu-item>
        <el-menu-item index="/dubber">
          <el-icon>
            <User />
          </el-icon>
          <template #title>配音员管理</template>
        </el-menu-item>
        <el-menu-item index="/prompt">
          <el-icon>
            <ChatDotRound />
          </el-icon>
          <template #title>提示词管理</template>
        </el-menu-item>
        <el-menu-item index="/model">
          <el-icon>
            <Cpu />
          </el-icon>
          <template #title>AI模型管理</template>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon>
            <Setting />
          </el-icon>
          <template #title>系统设置</template>
        </el-menu-item>

        <div class="pbut">
          <!-- <el-tooltip
            content="主题切换"
            placement="right"
            :disabled="!isCollapse"
          >
            <el-button @click="toggleDark()">
              <el-icon>
                <Sunny v-if="isDark" />
                <Moon v-else />
              </el-icon>
              <span v-if="!isCollapse" style="margin-left: 8px">主题切换</span>
            </el-button>
          </el-tooltip> -->
          <el-tooltip
            :content="isCollapse ? '展开菜单' : '收起菜单'"
            placement="right"
            :disabled="!isCollapse"
          >
            <el-button @click="isCollapse = !isCollapse">
              <el-icon>
                <Fold v-if="!isCollapse" />
                <Expand v-else />
              </el-icon>
              <span v-if="!isCollapse" style="margin-left: 8px">收起菜单</span>
            </el-button>
          </el-tooltip>
        </div>
      </el-menu>
    </el-aside>
    <el-main>
      <div class="content">
        <router-view />
      </div>
    </el-main>
  </el-container>
</template>

<style scoped>
.menu {
  height: 100%;
  position: relative;
}

.menu:not(.el-menu--collapse) {
  width: 180px;
}

/* Logo 样式 */
.logo-wrapper {
  overflow: hidden;
}

.logo-container {
  display: flex;
  align-items: center;
  padding: 20px;
  gap: 12px;
  white-space: nowrap;
}

.el-menu--collapse .logo-container {
  justify-content: center;
  padding: 20px 0;
}

.logo-img {
  width: 32px;
  height: 32px;
  background-color: #fdfdfd; /* Logo 占位符的深色背景 */
  border-radius: 8px;
  padding: 4px;
}

.logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  overflow: hidden;
}

.app-name {
  font-weight: bold;
  font-size: 16px;
  color: var(--el-text-color-primary);
}

.app-version {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.pbut {
  width: 100%;
  display: flex;
  flex-direction: column; /* 按钮垂直堆叠 */
  justify-content: center;
  align-items: center;
  position: absolute;
  bottom: 20px;
  left: 0;
  box-sizing: border-box;
  gap: 10px;
}

.pbut .el-button {
  margin: 0;
  justify-content: flex-end;
  border: none;
  background: transparent;
  color: var(--el-text-color-regular);
}

/* 当菜单收起时，调整按钮容器的样式 */
.el-menu.is-collapse .pbut {
  padding: 0;
}

/* 当菜单收起时，按钮居中显示 */
.el-menu.is-collapse .pbut .el-button {
  justify-content: center;
}

.pbut .el-button:hover {
  color: var(--el-color-primary);
  background-color: var(--el-fill-color-light);
}

/* 响应式布局 */
@media (max-width: 300px) {
  .pbut {
    padding: 0 5px;
  }
}

.content {
  height: 100%;
  width: 100%;
}

:deep(.el-main) {
  padding: 0 !important;
}

.gradient-text {
  font-size: 50px;
  font-weight: bold;
  background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
</style>
