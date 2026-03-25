/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/no-unresolved */
import fs from 'node:fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import electron from 'vite-plugin-electron/simple';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import pkg from './package.json';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  fs.rmSync('dist-electron', { recursive: true, force: true });

  const isServe = command === 'serve';
  const isBuild = command === 'build';
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG;

  return {
    plugins: [
      vue(),
      electron({
        main: {
          // `build.lib.entry`的快捷方式
          entry: 'electron/main/index.ts',
          onstart({ startup }) {
            if (process.env.VSCODE_DEBUG) {
              console.log(
                /* 用于 `.vscode/.debug.script.mjs` */ '[启动] Electron应用',
              );
            } else {
              startup();
            }
          },
          vite: {
            build: {
              sourcemap,
              minify: isBuild,
              outDir: 'dist-electron/main',
              rollupOptions: {
                // 一些第三方Node.js库可能无法被Vite正确构建，尤其是`C/C++`插件，
                // 我们可以使用`external`来排除它们以确保它们正常工作。
                // 其他则需要将它们放在`dependencies`中，以确保在应用构建后它们被收集到`app.asar`中。
                // 当然，这不是绝对的，只是这种方式相对简单。:)
                external: Object.keys(
                  'dependencies' in pkg ? pkg.dependencies : {},
                ),
              },
            },
          },
        },
        preload: {
          // `build.rollupOptions.input`的快捷方式。
          // 预加载脚本可能包含Web资源，因此使用`build.rollupOptions.input`而不是`build.lib.entry`。
          input: 'electron/preload/index.ts',
          vite: {
            build: {
              sourcemap: sourcemap ? 'inline' : undefined, // #332
              minify: isBuild,
              outDir: 'dist-electron/preload',
              rollupOptions: {
                external: Object.keys(
                  'dependencies' in pkg ? pkg.dependencies : {},
                ),
              },
            },
          },
        },
        // 为渲染进程提供Electron和Node.js API的兼容层。
        // 如果你想在渲染进程中使用Node.js，需要在主进程中启用`nodeIntegration`。
        // 查看 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
        renderer: {},
      }),
      AutoImport({
        imports: ['vue'],
        resolvers: [ElementPlusResolver()],
      }),
      Components({
        resolvers: [ElementPlusResolver()],
      }),
    ],
    server: (() => {
      const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL);
      return {
        host: url.hostname,
        port: +url.port,
      };
    })(),
    clearScreen: false,
  };
});
