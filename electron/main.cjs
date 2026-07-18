const { app, BrowserWindow, shell } = require('electron');
const { fork } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');

const PORT = 37841;
let serverProcess;

function waitForServer(url, attempts = 60) {
  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => { response.resume(); resolve(); });
      request.on('error', () => { if (attempts-- <= 0) reject(new Error('澄境服务启动超时')); else setTimeout(check, 250); });
    };
    check();
  });
}

async function createWindow() {
  const resources = process.resourcesPath;
  const appRoot = app.isPackaged ? path.join(resources, 'app') : path.join(__dirname, '..', '.next', 'standalone');
  const serverFile = path.join(appRoot, 'server.js');
  const dataRoot = path.join(app.getPath('userData'), 'data');
  serverProcess = fork(serverFile, [], { env: { ...process.env, PORT: String(PORT), HOSTNAME: '127.0.0.1', LOCAL_DB_PATH: path.join(dataRoot, 'clarity.sqlite'), NODE_ENV: 'production' }, stdio: 'ignore' });
  await waitForServer(`http://127.0.0.1:${PORT}`);
  const window = new BrowserWindow({ width: 1440, height: 960, minWidth: 960, minHeight: 700, backgroundColor: '#10110f', title: '澄境 · CLARITY', webPreferences: { contextIsolation: true, sandbox: true } });
  await window.loadURL(`http://127.0.0.1:${PORT}`);
  window.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (serverProcess) serverProcess.kill(); if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (serverProcess) serverProcess.kill(); });
