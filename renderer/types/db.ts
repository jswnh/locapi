export type ApiProtocol =
  | 'REST'
  | 'GRAPHQL'
  | 'SOAP'
  | 'WS'
  | 'SOCKETIO'
  | 'MQTT'
  | 'GRPC';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface KeyValueItem {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export interface FormDataItem {
  id: string;
  key: string;
  value: string;
  type: 'text' | 'file';
  enabled: boolean;
  fileName?: string;
}

export type BodyType =
  | 'none'
  | 'formData'
  | 'x-www-form-urlencoded'
  | 'json'
  | 'javascript'
  | 'xml'
  | 'raw'
  | 'text'
  | 'html'
  | 'graphql';

export interface RequestBody {
  type: BodyType;
  raw: string;
  formData?: FormDataItem[];
  urlEncoded?: KeyValueItem[];
  graphql?: {
    query: string;
    variables: string;
  };
}

export type AuthType = 'none' | 'bearer' | 'basic' | 'apiKey';

export interface RequestAuth {
  type: AuthType;
  bearer?: {
    token: string;
  };
  basic?: {
    username: string;
    password?: string;
  };
  apiKey?: {
    key: string;
    value: string;
    addTo: 'header' | 'query';
  };
}

export interface RequestSettings {
  timeout: number;
  followRedirects: boolean;
  httpVersion?: 'auto' | '1.1' | '2';
  maxResponseSizeMb?: number;
  disableCookies?: boolean;
  responseFormatDetection?: 'auto' | 'json';
}

export interface GrpcConfig {
  protoPath?: string;
  serviceName?: string;
  methodName?: string;
  useTls?: boolean;
}

export interface MqttConfig {
  topic?: string;
  qos?: 0 | 1 | 2;
  retain?: boolean;
  clientId?: string;
}

export interface SocketIoConfig {
  path?: string;
  eventName?: string;
}

export interface ApiRequest {
  id: string;
  collection_id: string | null;
  folder_id: string | null;
  name: string;
  method: HttpMethod;
  protocol: ApiProtocol;
  url: string;
  headers: KeyValueItem[];
  params: KeyValueItem[];
  body: RequestBody;
  auth: RequestAuth;
  settings: RequestSettings;
  scripts?: {
    preRequest?: string;
    test?: string;
  };
  grpcConfig?: GrpcConfig;
  mqttConfig?: MqttConfig;
  socketIoConfig?: SocketIoConfig;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  collection_id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
  requests?: ApiRequest[];
  children?: Folder[];
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Collection {
  id: string;
  workspace_id?: string | null;
  name: string;
  description: string;
  color?: string;
  created_at: string;
  updated_at: string;
  folders?: Folder[];
  requests?: ApiRequest[];
}

export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface Environment {
  id: string;
  name: string;
  variables: EnvironmentVariable[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HistoryItem {
  id: string;
  request_id: string | null;
  method: string;
  protocol: ApiProtocol;
  url: string;
  status: number | null;
  status_text: string | null;
  duration_ms: number | null;
  size_bytes: number | null;
  request_snapshot: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: any;
  };
  response_snapshot: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
    body?: any;
    contentType?: string;
    error?: string;
  };
  executed_at: string;
}

export interface Cookie {
  id: string;
  domain: string;
  path: string;
  name: string;
  value: string;
  expires: string | null;
  http_only: boolean;
  secure: boolean;
  created_at: string;
  updated_at: string;
}
