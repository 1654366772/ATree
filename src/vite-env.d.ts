/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// eslint-disable-next-line no-unused-vars
interface Window {
  // 在 `electron/preload/index.ts` 中暴露
  ipcRenderer: import('electron').IpcRenderer;
}
