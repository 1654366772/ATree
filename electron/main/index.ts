/* eslint-disable no-underscore-dangle */
import { app, BrowserWindow, shell, ipcMain, protocol, net } from 'electron';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 构建后的目录结构
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main主进程
// │ └─┬ preload
// │   └── index.mjs   > 预加载脚本
// ├─┬ dist
// │ └── index.html    > Electron-Renderer渲染进程
//
process.env.APP_ROOT = path.join(__dirname, '../..');
const { APP_ROOT, VITE_DEV_SERVER_URL } = process.env;

export const MAIN_DIST = path.join(APP_ROOT!, 'dist-electron');
export const RENDERER_DIST = path.join(APP_ROOT!, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(APP_ROOT!, 'public')
  : RENDERER_DIST;

// 为Windows 7禁用GPU加速
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration();

// 为Windows 10+通知设置应用程序名称
if (process.platform === 'win32') app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let win: BrowserWindow | null = null;
let loadingWindow: BrowserWindow | null = null;
const preload = path.join(__dirname, '../preload/index.mjs');
const indexHtml = path.join(RENDERER_DIST, 'index.html');
const loadingHtml = path.join(RENDERER_DIST, 'loading.html');

async function createWindow() {
  loadingWindow = new BrowserWindow({
    frame: false,
    transparent: true,
    width: 400,
    height: 400,
    show: true,
  });

  win = new BrowserWindow({
    title: '主窗口',
    icon: path.join(process.env.VITE_PUBLIC, 'logo.ico'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload,
      // 警告：在生产环境中启用nodeIntegration和禁用contextIsolation是不安全的
      // nodeIntegration: true,

      // 考虑使用contextBridge.exposeInMainWorld
      // 更多信息请阅读 https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    // #298
    loadingWindow.loadURL(`${VITE_DEV_SERVER_URL}loading.html`);
    win.loadURL(VITE_DEV_SERVER_URL);
    // 如果应用未打包，打开开发工具
    // win.webContents.openDevTools()
  } else {
    loadingWindow.loadFile(loadingHtml);
    win.loadFile(indexHtml);
  }

  win.on('ready-to-show', () => {
    win?.show();
    win.maximize();
    loadingWindow?.close();
  });

  // 测试向Electron-Renderer主动推送消息
  win.webContents.on('did-finish-load', () => {
   
  });

  // 使所有链接在浏览器中打开，而不是在应用程序中
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url);
    return { action: 'deny' };
  });
  // win.webContents.on('will-navigate', (event, url) => { }) #344
}

app.whenReady().then(() => {
  protocol.handle('media', (request) => {
    try {
      const url = new URL(request.url);
      const filePath = url.searchParams.get('path');
      if (!filePath) return new Response('Path not specified', { status: 400 });

      const fileUrl = pathToFileURL(filePath).toString();
      return net.fetch(fileUrl);
    } catch (e) {
      console.error('Protocol error:', e);
      return new Response('Invalid request', { status: 400 });
    }
  });
  createWindow();
});

app.on('window-all-closed', () => {
  win = null;
  if (process.platform !== 'darwin') app.quit();
});

app.on('second-instance', () => {
  if (win) {
    // 如果用户尝试打开另一个实例，焦点放在主窗口上
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

// 新窗口示例参数: 新窗口url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`);
  } else {
    childWindow.loadFile(indexHtml, { hash: arg });
  }
});

let isDialogOpen = false;
ipcMain.handle('dialog:openFile', async (_event, { title, filters } = {}) => {
  if (isDialogOpen) return null;
  isDialogOpen = true;
  try {
    const { canceled, filePaths } =
      await require('electron').dialog.showOpenDialog(win!, {
        title: title || '打开文件',
        properties: ['openFile'],
        filters: filters || [{ name: '音频', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }],
      });
    if (!canceled) {
      return filePaths[0];
    }
    return null;
  } finally {
    isDialogOpen = false;
  }
});

ipcMain.handle('dialog:openDirectory', async () => {
  if (isDialogOpen) return null;
  isDialogOpen = true;
  try {
    const { canceled, filePaths } = await require('electron').dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
    });
    if (!canceled) {
      return filePaths[0];
    }
    return null;
  } finally {
    isDialogOpen = false;
  }
});

ipcMain.handle('dialog:saveFile', async (_event, { title, defaultPath, filters }) => {
  if (isDialogOpen) return null;
  isDialogOpen = true;
  try {
    const { canceled, filePath } = await require('electron').dialog.showSaveDialog(win!, {
      title: title || '保存文件',
      defaultPath: defaultPath || '',
      filters: filters || [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!canceled) {
      return filePath;
    }
    return null;
  } finally {
    isDialogOpen = false;
  }
});

ipcMain.handle('fs:write', async (_event, { filePath, content }) => {
  try {
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:readFile', async (_event, { filePath }) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return { success: true, content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:copyFile', async (_event, { srcPath, destPath }) => {
  try {
    const parentDir = path.dirname(destPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.copyFileSync(srcPath, destPath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:getFileMeta', async (_event, { filePath }) => {
  try {
    const stat = fs.statSync(filePath);
    const buffer = fs.readFileSync(filePath);
    const md5 = require('crypto').createHash('md5').update(buffer).digest('hex');
    return {
      success: true,
      size: stat.size,
      ctimeMs: stat.ctimeMs,
      mtimeMs: stat.mtimeMs,
      md5,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:rename', async (_event, { oldPath, newPath }) => {
  try {
    if (fs.existsSync(oldPath)) {
      // 确保 newPath 的父目录存在
      const parentDir = path.dirname(newPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      try {
        fs.renameSync(oldPath, newPath);
      } catch (err: any) {
        if (err.code === 'EXDEV' || err.code === 'EPERM') {
          fs.cpSync(oldPath, newPath, { recursive: true });
          try {
            fs.rmSync(oldPath, { recursive: true, force: true });
          } catch(rmError) {
            console.warn('由于文件锁定，无法完全删除旧目录，但文件已成功复制。', rmError);
          }
        } else {
          throw err;
        }
      }
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:delete', async (_event, { filePath }) => {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('api:uploadFile', async (_event, { url, filePath, headers, directory, fileName }) => {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const actualFileName = fileName || path.basename(filePath);

    // Electron 22+ 在 net.fetch 中支持 FormData
    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer]), actualFileName);
    if (directory) {
      formData.append('directory', directory);
    }
    if (fileName) {
      formData.append('file_name', fileName);
    }

    const resp = await net.fetch(url.trim().replace(/\/+$/, '') + '/upload_reference', {
      method: 'POST',
      body: formData,
      headers: headers,
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      return { success: false, status: resp.status, error: errorText };
    }

    const data = await resp.json();
    return { success: true, data };
  } catch (error: any) {
    console.error('IPC Upload Error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('api:infer', async (_event, { url, headers, data, savePath }) => {
  try {
    const resp = await net.fetch(url.trim().replace(/\/+$/, '') + '/infer', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(data),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      return { success: false, status: resp.status, error: errorText };
    }

    if (savePath) {
      // 如果目录不存在，则创建目录
      const dir = path.dirname(savePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 处理覆盖：删除具有相同索引前缀的文件
      try {
        const fileName = path.basename(savePath);
        const indexPrefix = fileName.split('_')[0];
        if (indexPrefix && fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            if (file.startsWith(`${indexPrefix}_`) && file.endsWith('.wav')) {
              fs.unlinkSync(path.join(dir, file));
            }
          }
        }
      } catch (e) {
        console.warn('Failed to clean up old audio files:', e);
      }

      // 如果是音频格式，我们直接将 buffer 保存到磁盘
      const arrayBuffer = await resp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(savePath, buffer);
      
      return { success: true, savedPath: savePath };
    } else {
      // 如果未提供 savePath，则回退尝试 JSON（此处通常不适用）
      const respData = await resp.json();
      return { success: true, data: respData };
    }
  } catch (error: any) {
    console.error('IPC Infer Error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('api:checkFileExists', async (_event, { url, path }) => {
  try {
    const resp = await net.fetch(`${url.trim().replace(/\/+$/, '')}/check_file_exists?path=${encodeURIComponent(path)}`, {
      method: 'GET',
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      return { success: false, status: resp.status, error: errorText };
    }

    const contentType = resp.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await resp.json();
    } else {
      const text = await resp.text();
      data = text.trim() === 'true' ? true : (text.trim() === 'false' ? false : text);
    }
    return { success: true, data };
  } catch (error: any) {
    console.error('IPC checkFileExists Error:', error);
    return { success: false, error: error.message };
  }
});

//语音生成服务心跳检测
ipcMain.handle('api:heartbeat', async (_event, { url, retries = 0, interval = 1000 }) => {
  let attempt = 0;
  const maxAttempts = retries + 1;
  let lastErrorMsg = '';

  while (attempt < maxAttempts) {
    try {
      const resp = await net.fetch(`${url.trim().replace(/\/+$/, '')}/heartbeat`, {
        method: 'GET',
      });
      if (resp.ok) {
        return { success: true };
      }
      lastErrorMsg = `HTTP Error: ${resp.status}`;
    } catch (error: any) {
      lastErrorMsg = error.message;
    }

    attempt++;
    if (attempt < maxAttempts) {
      // 这里的 delay 变量可以根据需要定义，或者直接使用指数退避逻辑
      const delay = interval; 
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return { success: false, error: lastErrorMsg };
});

ipcMain.handle('shell:openPath', async (_event, { directoryPath }) => {
  try {
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
    }
    await shell.openPath(directoryPath);
    return { success: true };
  } catch (error: any) {
    console.error('IPC openPath Error:', error);
    return { success: false, error: error.message };
  }
});
