import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from './channels';

export function registerWindowHandlers(mainWindow?: BrowserWindow) {
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (win) {
      win.minimize();
      return true;
    }
    return false;
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (win) {
      if (win.isFullScreen()) {
        win.setFullScreen(false);
      } else if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
      return win.isMaximized() || win.isFullScreen();
    }
    return false;
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (win) {
      win.close();
      return true;
    }
    return false;
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    return win ? win.isMaximized() || win.isFullScreen() : false;
  });

  if (mainWindow) {
    const notifyStateChange = () => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          IPC_CHANNELS.WINDOW_MAXIMIZE_CHANGE,
          mainWindow.isMaximized() || mainWindow.isFullScreen()
        );
      }
    };

    mainWindow.on('maximize', notifyStateChange);
    mainWindow.on('unmaximize', notifyStateChange);
    mainWindow.on('enter-full-screen', notifyStateChange);
    mainWindow.on('leave-full-screen', notifyStateChange);
  }

  console.log('[IPC] Registered window control handlers');
}
