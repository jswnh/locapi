import { ipcMain } from 'electron';
import { IPC_CHANNELS } from './channels';
import * as collectionQueries from '../db/queries/collections';
import * as requestQueries from '../db/queries/requests';
import * as historyQueries from '../db/queries/history';
import * as envQueries from '../db/queries/environments';

export function registerDbHandlers() {
  // Collections
  ipcMain.handle(IPC_CHANNELS.COLLECTIONS_LIST, async (_event, workspaceId?: string) => {
    return collectionQueries.listCollections(workspaceId);
  });

  ipcMain.handle(IPC_CHANNELS.COLLECTIONS_GET, async (_event, id: string) => {
    return collectionQueries.getCollection(id);
  });

  ipcMain.handle(
    IPC_CHANNELS.COLLECTIONS_CREATE,
    async (_event, data: { name: string; description?: string; color?: string; workspaceId?: string }) => {
      return collectionQueries.createCollection(data);
    }
  );

  ipcMain.handle(IPC_CHANNELS.COLLECTIONS_UPDATE, async (_event, id: string, data: { name?: string; description?: string; color?: string }) => {
    return collectionQueries.updateCollection(id, data);
  });

  ipcMain.handle(IPC_CHANNELS.COLLECTIONS_DELETE, async (_event, id: string) => {
    return collectionQueries.deleteCollection(id);
  });

  // Folders
  ipcMain.handle(IPC_CHANNELS.FOLDERS_CREATE, async (_event, data: { collectionId: string; parentId?: string | null; name: string }) => {
    return collectionQueries.createFolder(data);
  });

  ipcMain.handle(IPC_CHANNELS.FOLDERS_UPDATE, async (_event, id: string, data: { name: string }) => {
    return collectionQueries.updateFolder(id, data);
  });

  ipcMain.handle(IPC_CHANNELS.FOLDERS_DELETE, async (_event, id: string) => {
    return collectionQueries.deleteFolder(id);
  });

  // Requests
  ipcMain.handle(IPC_CHANNELS.REQUESTS_GET, async (_event, id: string) => {
    return requestQueries.getRequest(id);
  });

  ipcMain.handle(IPC_CHANNELS.REQUESTS_CREATE, async (_event, data: any) => {
    return requestQueries.createRequest(data);
  });

  ipcMain.handle(IPC_CHANNELS.REQUESTS_UPDATE, async (_event, id: string, data: any) => {
    return requestQueries.updateRequest(id, data);
  });

  ipcMain.handle(IPC_CHANNELS.REQUESTS_DELETE, async (_event, id: string) => {
    return requestQueries.deleteRequest(id);
  });

  ipcMain.handle(IPC_CHANNELS.REQUESTS_DUPLICATE, async (_event, id: string) => {
    return requestQueries.duplicateRequest(id);
  });

  ipcMain.handle(IPC_CHANNELS.REQUESTS_REORDER, async (_event, items: any[]) => {
    return requestQueries.reorderRequests(items);
  });

  // History
  ipcMain.handle(IPC_CHANNELS.HISTORY_LIST, async (_event, limit?: number) => {
    return historyQueries.listHistory(limit);
  });

  ipcMain.handle(IPC_CHANNELS.HISTORY_ADD, async (_event, data: any) => {
    return historyQueries.addHistory(data);
  });

  ipcMain.handle(IPC_CHANNELS.HISTORY_CLEAR, async () => {
    return historyQueries.clearHistory();
  });

  // Environments
  ipcMain.handle(IPC_CHANNELS.ENVIRONMENTS_LIST, async () => {
    return envQueries.listEnvironments();
  });

  ipcMain.handle(IPC_CHANNELS.ENVIRONMENTS_CREATE, async (_event, name: string, variables?: any[]) => {
    return envQueries.createEnvironment(name, variables);
  });

  ipcMain.handle(IPC_CHANNELS.ENVIRONMENTS_UPDATE, async (_event, id: string, data: any) => {
    return envQueries.updateEnvironment(id, data);
  });

  ipcMain.handle(IPC_CHANNELS.ENVIRONMENTS_SET_ACTIVE, async (_event, id: string | null) => {
    return envQueries.setActiveEnvironment(id);
  });

  ipcMain.handle(IPC_CHANNELS.ENVIRONMENTS_DELETE, async (_event, id: string) => {
    return envQueries.deleteEnvironment(id);
  });

  console.log('[IPC] Registered all SQLite database handlers');
}
