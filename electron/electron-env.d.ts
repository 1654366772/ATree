/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    VSCODE_DEBUG?: 'true';
    /**
     * 构建后的目录结构
     *
     * ```tree
     * ├─┬ dist-electron
     * │ ├─┬ main
     * │ │ └── index.js    > Electron-Main主进程
     * │ └─┬ preload
     * │   └── index.mjs   > 预加载脚本
     * ├─┬ dist
     * │ └── index.html    > Electron-Renderer渲染进程
     * ```
     */
    APP_ROOT: string;
    /** /dist/ 或 /public/ */
    VITE_PUBLIC: string;
  }
}
