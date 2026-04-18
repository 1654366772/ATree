# ATree 🌳

ATree 是一款基于 Electron + Vue 3 开发的桌面端应用程序，专注于提供高效的文章管理、AI 模型管理以及智能配音与连载台本处理相关的集成环境。
- [详细使用手册](https://pcne36pdbf1o.feishu.cn/wiki/DYD5wQYCfibY5mkEmaIc9IWun6g?from=from_copylink)

## ✨ 核心特性

- 🎙️ **智能配音管理 (Dub Manager)**: 包含可视化的配音任务队列管理，支持一键台词解析、角色列表分配等复杂长音频任务。
- 🎬 **剪映草稿导出 (Jianying Export)**: 支持导出剪映专业版草稿工程，自动关联音频与字幕，大幅提升短视频创作效率。
- 🎞️ **PR 工程导出 (Premiere Pro Export)**: 支持导出标准 FCPXML 格式文件，可直接导入 Premiere Pro 进行专业后期工作流。
- 📝 **内容组织与文章管理 (Article Manager)**: 结构化的本地长文与章节碎片整理功能。
- 🧠 **AI 模型托管 (AI Model Manager)**: 集中接入与管理不同的 AI 语言模型或生成引擎。
- 💡 **提示词管理库 (Prompt Manager)**: 沉淀与动态维护高质量性 AI 交互提示词模板池。
- ⚡ **现代化客户端引擎**: 构建于 Vue 3, Vite, TypeScript 与 Electron 架构栈，兼顾丝滑性能和主流桌面的全平台覆盖。

## 🧰 技术底座

- **视图层**: [Vue 3](https://vuejs.org/) (`<script setup>` 组合式 API)
- **类型系统**: [TypeScript](https://www.typescriptlang.org/)
- **桌面引擎**: [Electron](https://www.electronjs.org/) 
- **工程化构建**: [Vite](https://vitejs.dev/) + Electron-Builder
- **UI 组件库**: [Element Plus](https://element-plus.org/)
- **本地化存储**: 原生 IndexedDB (`idb` 封装)

## 🚀 快速开始

### 环境依赖

- Node.js (推荐 v18+ 或更新的 LTS 版本)
- 建议使用 npm

### 开发调试

1. 安装项目所有依赖：
   ```bash
   npm install
   ```

2. 启动本地热重载开发服务器：
   ```bash
   npm run dev
   ```
### 启动语音生成API服务
   把api_v2.py放到indextts2的根目录下后运行
   ```bash
   python api_v2.py
   ```
### 生产打包

执行以下命令将代码打包独立的可执行桌面应用程序：
```bash
npm run build
```

## 📝 致谢
本项目基于以下开源项目构建，在此感谢原作者的无私贡献：

- 脚手架：[electron-vite-vue](https://github.com/electron-vite/electron-vite-vue)
- 语音生成：[IndexTTS2](https://github.com/index-tts/index-tts)
- 解析台词提示词：[音谷 - AI 多角色多情绪配音平台](https://github.com/xcLee001/SonicVale)


**ATree** 整体代码基于 **非商业性开源协议** 发布。
本项目采用 **[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International Public License (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/)** 许可协议。

**核心约束说明：**
- ✅ **共享与修改**：您完全可以免费下载、体验、学习代码，或是针对自身需求进行定制化修改与二次开发。
- ❌ **禁止商业用途 (NonCommercial)**：您不得将本项目原代码或二次修改后的程序用于任何商业获利行为（包括但不限于出售副本、内置广告、付费订阅或接入企业商业后端等）。
- ♻️ **相同方式共享 (ShareAlike)**：如果您对本项目进行了修改或二次发布，那么您也必须 **强行以相同的 CC BY-NC-SA 4.0 协议对外开源**，不可将衍生程序闭源私有化。

> 更详细的授权条文请参阅项目根目录下的 [`LICENSE`](./LICENSE) 文件。
