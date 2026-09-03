export const IPC_CHANNELS = {
  // Workspaces
  WORKSPACES_LIST: 'db:workspaces:list',
  WORKSPACES_GET_ACTIVE: 'db:workspaces:get-active',
  WORKSPACES_CREATE: 'db:workspaces:create',
  WORKSPACES_UPDATE: 'db:workspaces:update',
  WORKSPACES_SET_ACTIVE: 'db:workspaces:setActive',
  WORKSPACES_DELETE: 'db:workspaces:delete',

  // Collections
  COLLECTIONS_LIST: 'db:collections:list',
  COLLECTIONS_GET: 'db:collections:get',
  COLLECTIONS_CREATE: 'db:collections:create',
  COLLECTIONS_UPDATE: 'db:collections:update',
  COLLECTIONS_DELETE: 'db:collections:delete',

  // Folders
  FOLDERS_CREATE: 'db:folders:create',
  FOLDERS_UPDATE: 'db:folders:update',
  FOLDERS_DELETE: 'db:folders:delete',

  // Requests
  REQUESTS_GET: 'db:requests:get',
  REQUESTS_CREATE: 'db:requests:create',
  REQUESTS_UPDATE: 'db:requests:update',
  REQUESTS_DELETE: 'db:requests:delete',
  REQUESTS_DUPLICATE: 'db:requests:duplicate',
  REQUESTS_REORDER: 'db:requests:reorder',

  // History
  HISTORY_LIST: 'db:history:list',
  HISTORY_ADD: 'db:history:add',
  HISTORY_CLEAR: 'db:history:clear',

  // Environments
  ENVIRONMENTS_LIST: 'db:environments:list',
  ENVIRONMENTS_CREATE: 'db:environments:create',
  ENVIRONMENTS_UPDATE: 'db:environments:update',
  ENVIRONMENTS_SET_ACTIVE: 'db:environments:setActive',
  ENVIRONMENTS_DELETE: 'db:environments:delete',

  // Cookies Store
  COOKIES_LIST: 'db:cookies:list',
  COOKIES_SAVE: 'db:cookies:save',
  COOKIES_DELETE: 'db:cookies:delete',
  COOKIES_CLEAR: 'db:cookies:clear',

  // Window Controls
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:isMaximized',
  WINDOW_MAXIMIZE_CHANGE: 'window:maximizeChange',

  // Network Engine
  ENGINE_EXECUTE: 'engine:execute',
  ENGINE_CANCEL: 'engine:cancel',

  // WebSocket Engine
  WS_CONNECT: 'engine:ws:connect',
  WS_DISCONNECT: 'engine:ws:disconnect',
  WS_SEND: 'engine:ws:send',
  WS_EVENT: 'engine:ws:event',

  // Socket.IO Engine
  SOCKETIO_CONNECT: 'engine:socketio:connect',
  SOCKETIO_DISCONNECT: 'engine:socketio:disconnect',
  SOCKETIO_EMIT: 'engine:socketio:emit',
  SOCKETIO_EVENT: 'engine:socketio:event',

  // MQTT Engine
  MQTT_CONNECT: 'engine:mqtt:connect',
  MQTT_DISCONNECT: 'engine:mqtt:disconnect',
  MQTT_SUBSCRIBE: 'engine:mqtt:subscribe',
  MQTT_UNSUBSCRIBE: 'engine:mqtt:unsubscribe',
  MQTT_PUBLISH: 'engine:mqtt:publish',
  MQTT_EVENT: 'engine:mqtt:event',

  // gRPC Engine
  GRPC_LOAD_PROTO: 'engine:grpc:load-proto',
  GRPC_EXECUTE: 'engine:grpc:execute',

  // Data Export / Import
  DATA_EXPORT_WORKSPACE: 'data:export-workspace',
  DATA_EXPORT_COLLECTION: 'data:export-collection',
  DATA_IMPORT: 'data:import',
  DIALOG_SAVE_FILE: 'dialog:save-file',
  DIALOG_OPEN_FILE: 'dialog:open-file',
  DIALOG_SELECT_FILE: 'dialog:select-file',
  DIALOG_SELECT_DIRECTORY: 'dialog:select-directory',
  SYSTEM_OPEN_PATH: 'system:open-path',
  APP_GET_VERSION: 'app:get-version',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
