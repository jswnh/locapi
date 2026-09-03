import {
  Collection,
  Folder,
  ApiRequest,
  Environment,
  HistoryItem,
  EnvironmentVariable,
  Workspace,
  Cookie,
} from '@/types/db';
import { IPC_CHANNELS } from '../../main/ipc/channels';
import { handleFallbackIpc } from './ipc-fallback';

function invoke<T>(channel: string, ...args: any[]): Promise<T> {
  if (typeof window === 'undefined' || !window.ipc || !window.ipc.invoke) {
    return handleFallbackIpc<T>(channel, ...args);
  }
  return window.ipc.invoke<T>(channel, ...args);
}

export interface WsStreamEvent {
  type: 'open' | 'message' | 'error' | 'close';
  connectionId: string;
  payload?: string;
  direction?: 'in' | 'out';
  error?: string;
  code?: number;
  reason?: string;
  timestamp: string;
}

export interface SocketIoStreamEvent {
  type: 'connect' | 'disconnect' | 'event' | 'emitted' | 'error';
  connectionId: string;
  eventName?: string;
  payload?: any;
  direction?: 'in' | 'out';
  error?: string;
  timestamp: string;
}

export interface MqttStreamEvent {
  type: 'connect' | 'disconnect' | 'message' | 'published' | 'subscribed' | 'error';
  connectionId: string;
  topic?: string;
  payload?: string;
  qos?: number;
  retain?: boolean;
  direction?: 'in' | 'out';
  error?: string;
  timestamp: string;
}

export const api = {
  workspaces: {
    list: () => invoke<Workspace[]>(IPC_CHANNELS.WORKSPACES_LIST),
    getActive: () => invoke<Workspace | null>(IPC_CHANNELS.WORKSPACES_GET_ACTIVE),
    create: (data: { name: string; description?: string }) =>
      invoke<Workspace>(IPC_CHANNELS.WORKSPACES_CREATE, data),
    update: (id: string, data: { name?: string; description?: string }) =>
      invoke<Workspace | null>(IPC_CHANNELS.WORKSPACES_UPDATE, id, data),
    setActive: (id: string) => invoke<boolean>(IPC_CHANNELS.WORKSPACES_SET_ACTIVE, id),
    delete: (id: string) => invoke<boolean>(IPC_CHANNELS.WORKSPACES_DELETE, id),
  },
  collections: {
    list: (workspaceId?: string) => invoke<Collection[]>(IPC_CHANNELS.COLLECTIONS_LIST, workspaceId),
    get: (id: string) => invoke<Collection | null>(IPC_CHANNELS.COLLECTIONS_GET, id),
    create: (data: { name: string; description?: string; color?: string; workspaceId?: string }) =>
      invoke<Collection>(IPC_CHANNELS.COLLECTIONS_CREATE, data),
    update: (id: string, data: { name?: string; description?: string; color?: string }) =>
      invoke<Collection | null>(IPC_CHANNELS.COLLECTIONS_UPDATE, id, data),
    delete: (id: string) => invoke<boolean>(IPC_CHANNELS.COLLECTIONS_DELETE, id),
  },
  folders: {
    create: (data: { collectionId: string; parentId?: string | null; name: string }) =>
      invoke<Folder>(IPC_CHANNELS.FOLDERS_CREATE, data),
    update: (id: string, data: { name: string }) =>
      invoke<boolean>(IPC_CHANNELS.FOLDERS_UPDATE, id, data),
    delete: (id: string) => invoke<boolean>(IPC_CHANNELS.FOLDERS_DELETE, id),
  },
  requests: {
    get: (id: string) => invoke<ApiRequest | null>(IPC_CHANNELS.REQUESTS_GET, id),
    create: (data: Partial<ApiRequest>) => invoke<ApiRequest>(IPC_CHANNELS.REQUESTS_CREATE, data),
    update: (id: string, data: Partial<ApiRequest>) =>
      invoke<ApiRequest | null>(IPC_CHANNELS.REQUESTS_UPDATE, id, data),
    delete: (id: string) => invoke<boolean>(IPC_CHANNELS.REQUESTS_DELETE, id),
    duplicate: (id: string) => invoke<ApiRequest | null>(IPC_CHANNELS.REQUESTS_DUPLICATE, id),
    reorder: (items: { id: string; sort_order: number; folder_id?: string | null; collection_id?: string | null }[]) =>
      invoke<boolean>(IPC_CHANNELS.REQUESTS_REORDER, items),
  },
  history: {
    list: (limit?: number) => invoke<HistoryItem[]>(IPC_CHANNELS.HISTORY_LIST, limit),
    add: (data: Partial<HistoryItem>) => invoke<HistoryItem>(IPC_CHANNELS.HISTORY_ADD, data),
    clear: () => invoke<boolean>(IPC_CHANNELS.HISTORY_CLEAR),
  },
  environments: {
    list: () => invoke<Environment[]>(IPC_CHANNELS.ENVIRONMENTS_LIST),
    create: (name: string, variables?: EnvironmentVariable[]) =>
      invoke<Environment>(IPC_CHANNELS.ENVIRONMENTS_CREATE, name, variables),
    update: (id: string, data: Partial<Environment>) =>
      invoke<Environment | null>(IPC_CHANNELS.ENVIRONMENTS_UPDATE, id, data),
    setActive: (id: string | null) =>
      invoke<boolean>(IPC_CHANNELS.ENVIRONMENTS_SET_ACTIVE, id),
    delete: (id: string) => invoke<boolean>(IPC_CHANNELS.ENVIRONMENTS_DELETE, id),
  },
  engine: {
    execute: (request: ApiRequest) => invoke<any>(IPC_CHANNELS.ENGINE_EXECUTE, request),
  },
  ws: {
    connect: (payload: { connectionId: string; url: string; headers?: Record<string, string> }) =>
      invoke<boolean>(IPC_CHANNELS.WS_CONNECT, payload),
    send: (payload: { connectionId: string; message: string }) =>
      invoke<boolean>(IPC_CHANNELS.WS_SEND, payload),
    disconnect: (connectionId: string) =>
      invoke<boolean>(IPC_CHANNELS.WS_DISCONNECT, connectionId),
    onEvent: (callback: (event: WsStreamEvent) => void) => {
      if (typeof window === 'undefined' || !window.ipc || !window.ipc.on) {
        return () => {};
      }
      return window.ipc.on(IPC_CHANNELS.WS_EVENT, callback);
    },
  },
  socketio: {
    connect: (payload: {
      connectionId: string;
      url: string;
      options?: { path?: string; auth?: Record<string, any> };
    }) => invoke<boolean>(IPC_CHANNELS.SOCKETIO_CONNECT, payload),
    emit: (payload: { connectionId: string; eventName: string; data: any }) =>
      invoke<boolean>(IPC_CHANNELS.SOCKETIO_EMIT, payload),
    disconnect: (connectionId: string) =>
      invoke<boolean>(IPC_CHANNELS.SOCKETIO_DISCONNECT, connectionId),
    onEvent: (callback: (event: SocketIoStreamEvent) => void) => {
      if (typeof window === 'undefined' || !window.ipc || !window.ipc.on) {
        return () => {};
      }
      return window.ipc.on(IPC_CHANNELS.SOCKETIO_EVENT, callback);
    },
  },
  mqtt: {
    connect: (payload: {
      connectionId: string;
      brokerUrl: string;
      options?: {
        clientId?: string;
        username?: string;
        password?: string;
        clean?: boolean;
      };
    }) => invoke<boolean>(IPC_CHANNELS.MQTT_CONNECT, payload),
    subscribe: (payload: { connectionId: string; topic: string; qos?: 0 | 1 | 2 }) =>
      invoke<boolean>(IPC_CHANNELS.MQTT_SUBSCRIBE, payload),
    unsubscribe: (payload: { connectionId: string; topic: string }) =>
      invoke<boolean>(IPC_CHANNELS.MQTT_UNSUBSCRIBE, payload),
    publish: (payload: {
      connectionId: string;
      topic: string;
      message: string;
      options?: { qos?: 0 | 1 | 2; retain?: boolean };
    }) => invoke<boolean>(IPC_CHANNELS.MQTT_PUBLISH, payload),
    disconnect: (connectionId: string) =>
      invoke<boolean>(IPC_CHANNELS.MQTT_DISCONNECT, connectionId),
    onEvent: (callback: (event: MqttStreamEvent) => void) => {
      if (typeof window === 'undefined' || !window.ipc || !window.ipc.on) {
        return () => {};
      }
      return window.ipc.on(IPC_CHANNELS.MQTT_EVENT, callback);
    },
  },
  grpc: {
    loadProto: (protoFilePath: string) =>
      invoke<any[]>(IPC_CHANNELS.GRPC_LOAD_PROTO, protoFilePath),
    execute: (payload: {
      endpoint: string;
      protoPath: string;
      serviceName: string;
      methodName: string;
      payload: any;
      metadata?: Record<string, string>;
      useTls?: boolean;
    }) => invoke<any>(IPC_CHANNELS.GRPC_EXECUTE, payload),
  },
  window: {
    minimize: () => invoke<boolean>(IPC_CHANNELS.WINDOW_MINIMIZE),
    maximize: () => invoke<boolean>(IPC_CHANNELS.WINDOW_MAXIMIZE),
    close: () => invoke<boolean>(IPC_CHANNELS.WINDOW_CLOSE),
    isMaximized: () => invoke<boolean>(IPC_CHANNELS.WINDOW_IS_MAXIMIZED),
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
      if (typeof window === 'undefined' || !window.ipc || !window.ipc.on) {
        return () => {};
      }
      return window.ipc.on(IPC_CHANNELS.WINDOW_MAXIMIZE_CHANGE, callback);
    },
  },
  data: {
    exportWorkspace: (workspaceId?: string) =>
      invoke<string>(IPC_CHANNELS.DATA_EXPORT_WORKSPACE, workspaceId),
    exportCollection: (collectionId: string) =>
      invoke<string>(IPC_CHANNELS.DATA_EXPORT_COLLECTION, collectionId),
    importPayload: (content: string, workspaceId?: string) =>
      invoke<{
        success: boolean;
        type: string;
        name: string;
        collectionsImported: number;
        requestsImported: number;
        error?: string;
      }>(IPC_CHANNELS.DATA_IMPORT, { content, workspaceId }),
    saveFile: (defaultName: string, content: string) =>
      invoke<{ success: boolean; filePath?: string }>(IPC_CHANNELS.DIALOG_SAVE_FILE, {
        defaultName,
        content,
      }),
    openFile: () =>
      invoke<{ filename: string; content: string } | null>(IPC_CHANNELS.DIALOG_OPEN_FILE),
    selectFile: () =>
      invoke<{ filePath: string; fileName: string } | null>(IPC_CHANNELS.DIALOG_SELECT_FILE),
    selectDirectory: (defaultPath?: string) =>
      invoke<string | null>(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY, defaultPath),
  },
  system: {
    openPath: (path: string) => invoke<boolean>(IPC_CHANNELS.SYSTEM_OPEN_PATH, path),
    getVersion: () => invoke<string>(IPC_CHANNELS.APP_GET_VERSION),
  },
  cookies: {
    list: (domain?: string) => invoke<Cookie[]>(IPC_CHANNELS.COOKIES_LIST, domain),
    save: (cookie: Omit<Cookie, 'id' | 'created_at' | 'updated_at'> & { id?: string }) =>
      invoke<Cookie>(IPC_CHANNELS.COOKIES_SAVE, cookie),
    delete: (id: string) => invoke<boolean>(IPC_CHANNELS.COOKIES_DELETE, id),
    clear: (domain?: string) => invoke<boolean>(IPC_CHANNELS.COOKIES_CLEAR, domain),
  },
};
