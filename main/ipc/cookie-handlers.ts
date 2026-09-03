import { ipcMain } from 'electron';
import { IPC_CHANNELS } from './channels';
import {
  listCookies,
  saveCookie,
  deleteCookie,
  clearCookies,
  Cookie,
} from '../db/queries/cookies';

export function registerCookieHandlers() {
  ipcMain.handle(IPC_CHANNELS.COOKIES_LIST, async (_event, domain?: string) => {
    return listCookies(domain);
  });

  ipcMain.handle(
    IPC_CHANNELS.COOKIES_SAVE,
    async (
      _event,
      cookie: Omit<Cookie, 'id' | 'created_at' | 'updated_at'> & { id?: string }
    ) => {
      return saveCookie(cookie);
    }
  );

  ipcMain.handle(IPC_CHANNELS.COOKIES_DELETE, async (_event, id: string) => {
    return deleteCookie(id);
  });

  ipcMain.handle(IPC_CHANNELS.COOKIES_CLEAR, async (_event, domain?: string) => {
    return clearCookies(domain);
  });

  console.log('[IPC] Registered Cookie Store handlers');
}
