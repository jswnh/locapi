import { IPC_CHANNELS } from '../../main/ipc/channels';
import { Collection, Folder, ApiRequest, Workspace, Environment, HistoryItem, Cookie } from '@/types/db';

const STORAGE_KEYS = {
  WORKSPACES: 'locapi_web_workspaces',
  COLLECTIONS: 'locapi_web_collections',
  ENVIRONMENTS: 'locapi_web_environments',
  HISTORY: 'locapi_web_history',
  COOKIES: 'locapi_web_cookies',
  ACTIVE_WS: 'locapi_web_active_ws',
};

function getStored<T>(key: string, defaultVal: T): T {
  if (typeof window === 'undefined') return defaultVal;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function setStored<T>(key: string, val: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (err) {
    console.warn('[IPC Fallback] LocalStorage save error:', err);
  }
}

const DEFAULT_WORKSPACE: Workspace = {
  id: 'default-workspace',
  name: 'Default Workspace',
  description: 'Default personal workspace',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEFAULT_COLLECTIONS: Collection[] = [
  {
    id: 'col-default-1',
    workspace_id: 'default-workspace',
    name: 'Sample REST API',
    description: 'Sample collection with ready-to-test endpoints',
    color: '#0275E2',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    folders: [],
    requests: [
      {
        id: 'req-default-1',
        collection_id: 'col-default-1',
        folder_id: null,
        name: 'Get Random Quote',
        method: 'GET',
        protocol: 'REST',
        url: 'https://dummyjson.com/quotes/random',
        headers: [],
        params: [],
        body: { type: 'none', raw: '' },
        auth: { type: 'none' },
        settings: { timeout: 30000, followRedirects: true },
        sort_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'req-default-2',
        collection_id: 'col-default-1',
        folder_id: null,
        name: 'List Products',
        method: 'GET',
        protocol: 'REST',
        url: 'https://dummyjson.com/products?limit=5',
        headers: [],
        params: [{ id: 'p1', key: 'limit', value: '5', enabled: true }],
        body: { type: 'none', raw: '' },
        auth: { type: 'none' },
        settings: { timeout: 30000, followRedirects: true },
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
];

export async function handleFallbackIpc<T>(channel: string, ...args: any[]): Promise<T> {
  // Workspaces
  if (channel === IPC_CHANNELS.WORKSPACES_LIST) {
    const list = getStored<Workspace[]>(STORAGE_KEYS.WORKSPACES, [DEFAULT_WORKSPACE]);
    return list as unknown as T;
  }
  if (channel === IPC_CHANNELS.WORKSPACES_GET_ACTIVE) {
    const list = getStored<Workspace[]>(STORAGE_KEYS.WORKSPACES, [DEFAULT_WORKSPACE]);
    const activeId = getStored<string>(STORAGE_KEYS.ACTIVE_WS, list[0]?.id || DEFAULT_WORKSPACE.id);
    const active = list.find((w) => w.id === activeId) || list[0] || DEFAULT_WORKSPACE;
    return active as unknown as T;
  }
  if (channel === IPC_CHANNELS.WORKSPACES_SET_ACTIVE) {
    setStored(STORAGE_KEYS.ACTIVE_WS, args[0]);
    return true as unknown as T;
  }
  if (channel === IPC_CHANNELS.WORKSPACES_CREATE) {
    const payload = args[0] || {};
    const newWs: Workspace = {
      id: `ws-${Date.now()}`,
      name: payload.name || 'New Workspace',
      description: payload.description || '',
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const list = getStored<Workspace[]>(STORAGE_KEYS.WORKSPACES, [DEFAULT_WORKSPACE]);
    setStored(STORAGE_KEYS.WORKSPACES, [...list, newWs]);
    return newWs as unknown as T;
  }
  if (channel === IPC_CHANNELS.WORKSPACES_UPDATE) {
    const [id, patch] = args;
    const list = getStored<Workspace[]>(STORAGE_KEYS.WORKSPACES, [DEFAULT_WORKSPACE]);
    const idx = list.findIndex((w) => w.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...patch, updated_at: new Date().toISOString() };
      setStored(STORAGE_KEYS.WORKSPACES, list);
      return list[idx] as unknown as T;
    }
    return null as unknown as T;
  }
  if (channel === IPC_CHANNELS.WORKSPACES_DELETE) {
    const id = args[0];
    const list = getStored<Workspace[]>(STORAGE_KEYS.WORKSPACES, [DEFAULT_WORKSPACE]);
    setStored(
      STORAGE_KEYS.WORKSPACES,
      list.filter((w) => w.id !== id)
    );
    return true as unknown as T;
  }

  // Collections
  if (channel === IPC_CHANNELS.COLLECTIONS_LIST) {
    const collections = getStored<Collection[]>(STORAGE_KEYS.COLLECTIONS, DEFAULT_COLLECTIONS);
    const workspaceId = args[0];
    if (workspaceId) {
      return collections.filter((c) => c.workspace_id === workspaceId) as unknown as T;
    }
    return collections as unknown as T;
  }
  if (channel === IPC_CHANNELS.COLLECTIONS_GET) {
    const id = args[0];
    const collections = getStored<Collection[]>(STORAGE_KEYS.COLLECTIONS, DEFAULT_COLLECTIONS);
    return (collections.find((c) => c.id === id) || null) as unknown as T;
  }
  if (channel === IPC_CHANNELS.COLLECTIONS_CREATE) {
    const data = args[0] || {};
    const newCol: Collection = {
      id: `col-${Date.now()}`,
      workspace_id: data.workspaceId || 'default-workspace',
      name: data.name || 'New Collection',
      description: data.description || '',
      color: data.color || '#0275E2',
      folders: [],
      requests: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const collections = getStored<Collection[]>(STORAGE_KEYS.COLLECTIONS, DEFAULT_COLLECTIONS);
    setStored(STORAGE_KEYS.COLLECTIONS, [...collections, newCol]);
    return newCol as unknown as T;
  }
  if (channel === IPC_CHANNELS.COLLECTIONS_UPDATE) {
    const [id, patch] = args;
    const collections = getStored<Collection[]>(STORAGE_KEYS.COLLECTIONS, DEFAULT_COLLECTIONS);
    const idx = collections.findIndex((c) => c.id === id);
    if (idx !== -1) {
      collections[idx] = { ...collections[idx], ...patch, updated_at: new Date().toISOString() };
      setStored(STORAGE_KEYS.COLLECTIONS, collections);
      return collections[idx] as unknown as T;
    }
    return null as unknown as T;
  }
  if (channel === IPC_CHANNELS.COLLECTIONS_DELETE) {
    const id = args[0];
    const collections = getStored<Collection[]>(STORAGE_KEYS.COLLECTIONS, DEFAULT_COLLECTIONS);
    setStored(
      STORAGE_KEYS.COLLECTIONS,
      collections.filter((c) => c.id !== id)
    );
    return true as unknown as T;
  }

  // Folders
  if (channel === IPC_CHANNELS.FOLDERS_CREATE) {
    const data = args[0] || {};
    const newFolder: Folder = {
      id: `folder-${Date.now()}`,
      collection_id: data.collectionId,
      parent_id: data.parentId || null,
      name: data.name || 'New Folder',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      requests: [],
    };
    const collections = getStored<Collection[]>(STORAGE_KEYS.COLLECTIONS, DEFAULT_COLLECTIONS);
    const col = collections.find((c) => c.id === data.collectionId);
    if (col) {
      col.folders = [...(col.folders || []), newFolder];
      setStored(STORAGE_KEYS.COLLECTIONS, collections);
    }
    return newFolder as unknown as T;
  }
  if (channel === IPC_CHANNELS.FOLDERS_UPDATE) {
    const [id, patch] = args;
    const collections = getStored<Collection[]>(STORAGE_KEYS.COLLECTIONS, DEFAULT_COLLECTIONS);
    for (const c of collections) {
      const f = (c.folders || []).find((fold) => fold.id === id);
      if (f) {
        Object.assign(f, patch, { updated_at: new Date().toISOString() });
        setStored(STORAGE_KEYS.COLLECTIONS, collections);
        return true as unknown as T;
      }
    }
    return false as unknown as T;
  }
  if (channel === IPC_CHANNELS.FOLDERS_DELETE) {
    const id = args[0];
    const collections = getStored<Collection[]>(STORAGE_KEYS.COLLECTIONS, DEFAULT_COLLECTIONS);
    for (const c of collections) {
      if (c.folders) {
        c.folders = c.folders.filter((f) => f.id !== id);
      }
    }
    setStored(STORAGE_KEYS.COLLECTIONS, collections);
    return true as unknown as T;
  }

  // Requests
  if (channel === IPC_CHANNELS.REQUESTS_CREATE) {
    const data = args[0] || {};
    const newReq: ApiRequest = {
      id: `req-${Date.now()}`,
      collection_id: data.collection_id || null,
      folder_id: data.folder_id || null,
      name: data.name || 'New Request',
      method: data.method || 'GET',
      protocol: data.protocol || 'REST',
      url: data.url || 'https://dummyjson.com/quotes/random',
      headers: data.headers || [],
      params: data.params || [],
      body: data.body || { type: 'none', raw: '' },
      auth: data.auth || { type: 'none' },
      settings: data.settings || { timeout: 30000, followRedirects: true },
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const collections = getStored<Collection[]>(STORAGE_KEYS.COLLECTIONS, DEFAULT_COLLECTIONS);
    if (newReq.collection_id) {
      const col = collections.find((c) => c.id === newReq.collection_id);
      if (col) {
        if (newReq.folder_id) {
          const fold = (col.folders || []).find((f) => f.id === newReq.folder_id);
          if (fold) {
            fold.requests = [...(fold.requests || []), newReq];
          }
        } else {
          col.requests = [...(col.requests || []), newReq];
        }
        setStored(STORAGE_KEYS.COLLECTIONS, collections);
      }
    }
    return newReq as unknown as T;
  }
  if (channel === IPC_CHANNELS.REQUESTS_UPDATE) {
    const [id, patch] = args;
    const collections = getStored<Collection[]>(STORAGE_KEYS.COLLECTIONS, DEFAULT_COLLECTIONS);
    for (const c of collections) {
      const r = (c.requests || []).find((req) => req.id === id);
      if (r) {
        Object.assign(r, patch, { updated_at: new Date().toISOString() });
        setStored(STORAGE_KEYS.COLLECTIONS, collections);
        return r as unknown as T;
      }
      for (const f of c.folders || []) {
        const fr = (f.requests || []).find((req) => req.id === id);
        if (fr) {
          Object.assign(fr, patch, { updated_at: new Date().toISOString() });
          setStored(STORAGE_KEYS.COLLECTIONS, collections);
          return fr as unknown as T;
        }
      }
    }
    return null as unknown as T;
  }
  if (channel === IPC_CHANNELS.REQUESTS_DELETE) {
    const id = args[0];
    const collections = getStored<Collection[]>(STORAGE_KEYS.COLLECTIONS, DEFAULT_COLLECTIONS);
    for (const c of collections) {
      if (c.requests) {
        c.requests = c.requests.filter((r) => r.id !== id);
      }
      for (const f of c.folders || []) {
        if (f.requests) {
          f.requests = f.requests.filter((r) => r.id !== id);
        }
      }
    }
    setStored(STORAGE_KEYS.COLLECTIONS, collections);
    return true as unknown as T;
  }

  // Environments
  if (channel === IPC_CHANNELS.ENVIRONMENTS_LIST) {
    const envs = getStored<Environment[]>(STORAGE_KEYS.ENVIRONMENTS, []);
    return envs as unknown as T;
  }
  if (channel === IPC_CHANNELS.ENVIRONMENTS_CREATE) {
    const [name, variables] = args;
    const newEnv: Environment = {
      id: `env-${Date.now()}`,
      name: name || 'New Environment',
      is_active: false,
      variables: variables || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const envs = getStored<Environment[]>(STORAGE_KEYS.ENVIRONMENTS, []);
    setStored(STORAGE_KEYS.ENVIRONMENTS, [...envs, newEnv]);
    return newEnv as unknown as T;
  }
  if (channel === IPC_CHANNELS.ENVIRONMENTS_UPDATE) {
    const [id, patch] = args;
    const envs = getStored<Environment[]>(STORAGE_KEYS.ENVIRONMENTS, []);
    const idx = envs.findIndex((e) => e.id === id);
    if (idx !== -1) {
      envs[idx] = { ...envs[idx], ...patch, updated_at: new Date().toISOString() };
      setStored(STORAGE_KEYS.ENVIRONMENTS, envs);
      return envs[idx] as unknown as T;
    }
    return null as unknown as T;
  }
  if (channel === IPC_CHANNELS.ENVIRONMENTS_SET_ACTIVE) {
    const id = args[0];
    const envs = getStored<Environment[]>(STORAGE_KEYS.ENVIRONMENTS, []);
    envs.forEach((e) => {
      e.is_active = e.id === id;
    });
    setStored(STORAGE_KEYS.ENVIRONMENTS, envs);
    return true as unknown as T;
  }
  if (channel === IPC_CHANNELS.ENVIRONMENTS_DELETE) {
    const id = args[0];
    const envs = getStored<Environment[]>(STORAGE_KEYS.ENVIRONMENTS, []);
    setStored(
      STORAGE_KEYS.ENVIRONMENTS,
      envs.filter((e) => e.id !== id)
    );
    return true as unknown as T;
  }

  // History
  if (channel === IPC_CHANNELS.HISTORY_LIST) {
    const history = getStored<HistoryItem[]>(STORAGE_KEYS.HISTORY, []);
    return history as unknown as T;
  }
  if (channel === IPC_CHANNELS.HISTORY_ADD) {
    const data = args[0] || {};
    const newItem: HistoryItem = {
      id: `hist-${Date.now()}`,
      request_id: data.request_id || null,
      method: data.method || 'GET',
      protocol: data.protocol || 'REST',
      url: data.url || '',
      status: data.status || 200,
      status_text: data.status_text || 'OK',
      duration_ms: data.duration_ms || 120,
      size_bytes: data.size_bytes || 512,
      request_snapshot: data.request_snapshot || {},
      response_snapshot: data.response_snapshot || {},
      executed_at: new Date().toISOString(),
    };
    const history = getStored<HistoryItem[]>(STORAGE_KEYS.HISTORY, []);
    setStored(STORAGE_KEYS.HISTORY, [newItem, ...history].slice(0, 100));
    return newItem as unknown as T;
  }
  if (channel === IPC_CHANNELS.HISTORY_CLEAR) {
    setStored(STORAGE_KEYS.HISTORY, []);
    return true as unknown as T;
  }

  // Cookies
  if (channel === IPC_CHANNELS.COOKIES_LIST) {
    const cookies = getStored<Cookie[]>(STORAGE_KEYS.COOKIES, []);
    return cookies as unknown as T;
  }
  if (channel === IPC_CHANNELS.COOKIES_SAVE) {
    const c = args[0];
    const cookies = getStored<Cookie[]>(STORAGE_KEYS.COOKIES, []);
    const newCookie: Cookie = {
      id: c.id || `cookie-${Date.now()}`,
      domain: c.domain,
      name: c.name,
      value: c.value,
      path: c.path || '/',
      expires: c.expires || null,
      http_only: c.http_only ?? false,
      secure: c.secure ?? false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const nextCookies = [...cookies.filter((ck) => ck.id !== newCookie.id), newCookie];
    setStored(STORAGE_KEYS.COOKIES, nextCookies);
    return newCookie as unknown as T;
  }
  if (channel === IPC_CHANNELS.COOKIES_DELETE) {
    const id = args[0];
    const cookies = getStored<Cookie[]>(STORAGE_KEYS.COOKIES, []);
    setStored(
      STORAGE_KEYS.COOKIES,
      cookies.filter((c) => c.id !== id)
    );
    return true as unknown as T;
  }
  if (channel === IPC_CHANNELS.COOKIES_CLEAR) {
    setStored(STORAGE_KEYS.COOKIES, []);
    return true as unknown as T;
  }

  // Engine execution (Web Browser Fallback)
  if (channel === IPC_CHANNELS.ENGINE_EXECUTE) {
    const request = args[0] as ApiRequest;
    const start = performance.now();
    try {
      let fetchUrl = (request.url || '').trim();
      if (!fetchUrl.startsWith('http://') && !fetchUrl.startsWith('https://')) {
        fetchUrl = `https://${fetchUrl}`;
      }

      // Append query parameters
      try {
        const u = new URL(fetchUrl);
        (request.params || [])
          .filter((p) => p.enabled && p.key)
          .forEach((p) => u.searchParams.append(p.key, p.value));
        fetchUrl = u.toString();
      } catch {}

      const headersObj: Record<string, string> = {};
      (request.headers || [])
        .filter((h) => h.enabled && h.key)
        .forEach((h) => {
          headersObj[h.key] = h.value;
        });

      if (request.auth) {
        if (request.auth.type === 'bearer' && request.auth.bearer?.token) {
          headersObj['Authorization'] = `Bearer ${request.auth.bearer.token}`;
        } else if (request.auth.type === 'basic' && request.auth.basic?.username) {
          const creds = btoa(`${request.auth.basic.username}:${request.auth.basic.password || ''}`);
          headersObj['Authorization'] = `Basic ${creds}`;
        }
      }

      const method = (request.method || 'GET').toUpperCase();
      const allowsBody = !['GET', 'HEAD'].includes(method);
      let bodyPayload: any = undefined;
      if (allowsBody && request.body) {
        if (request.body.type === 'json' || request.protocol === 'GRAPHQL') {
          if (!headersObj['Content-Type']) headersObj['Content-Type'] = 'application/json';
          bodyPayload = request.body.raw;
        } else if (request.body.raw) {
          bodyPayload = request.body.raw;
        }
      }

      const res = await fetch(fetchUrl, {
        method,
        headers: headersObj,
        body: bodyPayload,
      });

      const rawText = await res.text();
      let parsedBody: any = rawText;
      try {
        parsedBody = JSON.parse(rawText);
      } catch {}

      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        resHeaders[k] = v;
      });

      const durationMs = Math.round(performance.now() - start);

      const result = {
        status: res.status,
        statusText: res.statusText || (res.ok ? 'OK' : 'Error'),
        headers: resHeaders,
        body: parsedBody,
        contentType: res.headers.get('content-type') || '',
        durationMs,
        sizeBytes: rawText.length,
        cookies: [],
      };

      // Auto save to history
      await handleFallbackIpc(IPC_CHANNELS.HISTORY_ADD, {
        request_id: request.id,
        method: request.method,
        protocol: request.protocol,
        url: fetchUrl,
        status: result.status,
        status_text: result.statusText,
        duration_ms: durationMs,
        size_bytes: result.sizeBytes,
        request_snapshot: { method: request.method, url: fetchUrl, headers: headersObj },
        response_snapshot: result,
      });

      return result as unknown as T;
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - start);
      return {
        status: 0,
        statusText: 'Network / CORS Notice',
        headers: {},
        body: null,
        contentType: '',
        durationMs,
        sizeBytes: 0,
        error: `Browser mode: ${err.message}. For complete zero-CORS requests, run Locapi in desktop mode.`,
      } as unknown as T;
    }
  }

  // Window Controls
  if (
    channel === IPC_CHANNELS.WINDOW_MINIMIZE ||
    channel === IPC_CHANNELS.WINDOW_MAXIMIZE ||
    channel === IPC_CHANNELS.WINDOW_CLOSE ||
    channel === IPC_CHANNELS.WINDOW_IS_MAXIMIZED
  ) {
    return false as unknown as T;
  }

  // Version
  if (channel === IPC_CHANNELS.APP_GET_VERSION) {
    return '1.0.0' as unknown as T;
  }

  // System
  if (channel === IPC_CHANNELS.SYSTEM_OPEN_PATH) {
    if (typeof window !== 'undefined') {
      window.open(args[0], '_blank');
    }
    return true as unknown as T;
  }

  // Data Export Workspace (Fallback)
  if (channel === IPC_CHANNELS.DATA_EXPORT_WORKSPACE) {
    const list = getStored<Workspace[]>(STORAGE_KEYS.WORKSPACES, [DEFAULT_WORKSPACE]);
    const collections = getStored<Collection[]>(STORAGE_KEYS.COLLECTIONS, DEFAULT_COLLECTIONS);
    const envs = getStored<Environment[]>(STORAGE_KEYS.ENVIRONMENTS, []);
    return JSON.stringify(
      {
        locapi_version: '1.0.0',
        type: 'workspace',
        exported_at: new Date().toISOString(),
        workspace: list[0] || DEFAULT_WORKSPACE,
        collections,
        environments: envs,
      },
      null,
      2
    ) as unknown as T;
  }

  // Data Export Collection (Fallback)
  if (channel === IPC_CHANNELS.DATA_EXPORT_COLLECTION) {
    const collections = getStored<Collection[]>(STORAGE_KEYS.COLLECTIONS, DEFAULT_COLLECTIONS);
    const target = collections.find((c) => c.id === args[0]);
    return JSON.stringify(
      {
        locapi_version: '1.0.0',
        type: 'collection',
        exported_at: new Date().toISOString(),
        collection: target || collections[0],
      },
      null,
      2
    ) as unknown as T;
  }

  // Dialog Save File (Fallback: browser download)
  if (channel === IPC_CHANNELS.DIALOG_SAVE_FILE) {
    const { defaultName, content } = args[0] || {};
    if (typeof window !== 'undefined' && content) {
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultName || 'export.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { success: true, filePath: defaultName } as unknown as T;
    }
    return { success: false } as unknown as T;
  }

  // Dialog Open File (Fallback: browser input file)
  if (channel === IPC_CHANNELS.DIALOG_OPEN_FILE) {
    if (typeof window !== 'undefined') {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return resolve(null as unknown as T);
          const text = await file.text();
          resolve({ filename: file.name, content: text } as unknown as T);
        };
        input.click();
      });
    }
    return null as unknown as T;
  }

  // Data Import (Fallback)
  if (channel === IPC_CHANNELS.DATA_IMPORT) {
    const { content } = args[0] || {};
    try {
      const parsed = JSON.parse(content || '{}');
      const collections = getStored<Collection[]>(STORAGE_KEYS.COLLECTIONS, DEFAULT_COLLECTIONS);
      if (parsed.type === 'collection' && parsed.collection) {
        setStored(STORAGE_KEYS.COLLECTIONS, [...collections, { ...parsed.collection, id: `col-${Date.now()}` }]);
        return {
          success: true,
          type: 'collection',
          name: parsed.collection.name || 'Imported Collection',
          collectionsImported: 1,
          requestsImported: parsed.collection.requests?.length || 0,
        } as unknown as T;
      }
      if (parsed.type === 'workspace' && Array.isArray(parsed.collections)) {
        setStored(STORAGE_KEYS.COLLECTIONS, [...collections, ...parsed.collections]);
        return {
          success: true,
          type: 'workspace',
          name: parsed.workspace?.name || 'Workspace Backup',
          collectionsImported: parsed.collections.length,
          requestsImported: parsed.collections.reduce((acc: number, c: any) => acc + (c.requests?.length || 0), 0),
        } as unknown as T;
      }
      return {
        success: true,
        type: 'collection',
        name: parsed.name || 'Imported Data',
        collectionsImported: 1,
        requestsImported: 1,
      } as unknown as T;
    } catch (e: any) {
      return {
        success: false,
        error: e.message,
      } as unknown as T;
    }
  }

  // Default fallback for unhandled channels
  console.warn(`[IPC Fallback] Channel "${channel}" simulated.`);
  return null as unknown as T;
}
