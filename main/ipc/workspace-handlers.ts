import { ipcMain } from 'electron';
import { IPC_CHANNELS } from './channels';
import {
  listWorkspaces,
  getActiveWorkspace,
  createWorkspace,
  updateWorkspace,
  setActiveWorkspace,
  deleteWorkspace,
} from '../db/queries/workspaces';

export function registerWorkspaceHandlers() {
  ipcMain.handle(IPC_CHANNELS.WORKSPACES_LIST, async () => {
    return listWorkspaces();
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACES_GET_ACTIVE, async () => {
    return getActiveWorkspace();
  });

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACES_CREATE,
    async (_event, data: { name: string; description?: string }) => {
      return createWorkspace(data);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACES_UPDATE,
    async (_event, id: string, data: { name?: string; description?: string }) => {
      return updateWorkspace(id, data);
    }
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACES_SET_ACTIVE, async (_event, id: string) => {
    return setActiveWorkspace(id);
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACES_DELETE, async (_event, id: string) => {
    return deleteWorkspace(id);
  });

  console.log('[IPC] Registered workspace handlers');
}
