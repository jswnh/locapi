import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from './channels';
import {
  exportWorkspace,
  exportCollection,
  importData,
  showSaveFileDialog,
  showOpenFileDialog,
} from '../engine/export-import';

export function registerDataHandlers(mainWindow?: BrowserWindow) {
  ipcMain.handle(IPC_CHANNELS.DATA_EXPORT_WORKSPACE, async (_event, workspaceId?: string) => {
    return exportWorkspace(workspaceId);
  });

  ipcMain.handle(IPC_CHANNELS.DATA_EXPORT_COLLECTION, async (_event, collectionId: string) => {
    return exportCollection(collectionId);
  });

  ipcMain.handle(
    IPC_CHANNELS.DATA_IMPORT,
    async (_event, payload: { content: string; workspaceId?: string }) => {
      return importData(payload.content, payload.workspaceId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.DIALOG_SAVE_FILE,
    async (event, payload: { defaultName: string; content: string }) => {
      const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
      return showSaveFileDialog(payload.defaultName, payload.content, win);
    }
  );

  ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_FILE, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    return showOpenFileDialog(win);
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FILE, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const { dialog } = await import('electron');
    const path = await import('path');
    const result = await dialog.showOpenDialog(win!, {
      title: 'Select File for Form Data',
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    return {
      filePath,
      fileName: path.basename(filePath),
    };
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY, async (event, defaultPath?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const { dialog } = await import('electron');
    const result = await dialog.showOpenDialog(win!, {
      title: 'Select Export Directory',
      defaultPath: defaultPath || undefined,
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_OPEN_PATH, async (_event, targetPath: string) => {
    const { shell } = await import('electron');
    if (!targetPath) return false;
    const err = await shell.openPath(targetPath);
    return err === '';
  });

  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, async () => {
    const { app } = await import('electron');
    return app.getVersion() || '1.0.0';
  });

  console.log('[IPC] Registered Universal Data Import & Export handlers');
}
