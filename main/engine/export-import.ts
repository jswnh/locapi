import fs from 'fs';
import { dialog, BrowserWindow } from 'electron';
import { getDb } from '../db/client';
import { listCollections, getCollection } from '../db/queries/collections';
import { listEnvironments } from '../db/queries/environments';
import { createWorkspace, getActiveWorkspace } from '../db/queries/workspaces';
import { v4 as uuidv4 } from 'uuid';

export interface ImportResult {
  success: boolean;
  type: 'workspace' | 'collection' | 'postman' | 'unknown';
  name: string;
  collectionsImported: number;
  requestsImported: number;
  error?: string;
}

// 1. Export Workspace
export function exportWorkspace(workspaceId?: string): string {
  const db = getDb();
  let wsId = workspaceId;

  if (!wsId) {
    const active = getActiveWorkspace();
    wsId = active ? active.id : undefined;
  }

  const ws = wsId
    ? (db.prepare('SELECT * FROM workspaces WHERE id = ?').get(wsId) as any)
    : (db.prepare('SELECT * FROM workspaces ORDER BY created_at ASC LIMIT 1').get() as any);

  const collections = listCollections(ws?.id);
  const environments = listEnvironments();

  const backupPayload = {
    locapi_version: '1.0.0',
    type: 'workspace',
    exported_at: new Date().toISOString(),
    workspace: {
      name: ws?.name || 'Workspace Export',
      description: ws?.description || '',
    },
    collections,
    environments,
  };

  return JSON.stringify(backupPayload, null, 2);
}

// 2. Export Collection
export function exportCollection(collectionId: string): string {
  const target = getCollection(collectionId);

  if (!target) {
    throw new Error('Collection not found');
  }

  const payload = {
    locapi_version: '1.0.0',
    type: 'collection',
    exported_at: new Date().toISOString(),
    collection: target,
  };

  return JSON.stringify(payload, null, 2);
}

// 3. Import Engine (Locapi Native + Postman / OpenAPI Support)
export function importData(rawContent: string, targetWorkspaceId?: string): ImportResult {
  let parsed: any;
  try {
    parsed = JSON.parse(rawContent.trim());
  } catch (err: any) {
    return {
      success: false,
      type: 'unknown',
      name: '',
      collectionsImported: 0,
      requestsImported: 0,
      error: `Invalid JSON: ${err.message}`,
    };
  }

  const db = getDb();
  let wsId = targetWorkspaceId;
  if (!wsId) {
    const active = getActiveWorkspace();
    wsId = active ? active.id : undefined;
  }

  if (!wsId) {
    const created = createWorkspace({ name: 'Imported Workspace' });
    wsId = created.id;
  }

  // A) Locapi Workspace Backup
  if (parsed.locapi_version && parsed.type === 'workspace') {
    return importLocapiWorkspace(db, parsed, wsId);
  }

  // B) Locapi Collection Backup
  if (parsed.locapi_version && parsed.type === 'collection' && parsed.collection) {
    return importLocapiCollection(db, parsed.collection, wsId);
  }

  // C) OpenAPI 3.0 / Swagger 2.0
  if (parsed.openapi || parsed.swagger) {
    return importOpenApiSpec(db, parsed, wsId);
  }

  // D) Postman Collection v2 / v2.1
  if (parsed.info && (parsed.info.schema?.includes('postman') || parsed.info._postman_id || parsed.item)) {
    return importPostmanCollection(db, parsed, wsId);
  }

  // E) Generic Collection format (array of requests or single collection object)
  if (parsed.name && Array.isArray(parsed.requests)) {
    return importLocapiCollection(db, parsed, wsId);
  }

  return {
    success: false,
    type: 'unknown',
    name: 'Unknown Format',
    collectionsImported: 0,
    requestsImported: 0,
    error: 'Unrecognized file format. Supported: Locapi backup (.json), Postman collection v2/v2.1 (.json), or OpenAPI/Swagger (.json)',
  };
}

function importLocapiWorkspace(db: any, payload: any, currentWsId: string): ImportResult {
  const collections = payload.collections || [];
  let totalRequests = 0;

  const insertCollection = db.prepare(`
    INSERT INTO collections (id, workspace_id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertFolder = db.prepare(`
    INSERT INTO folders (id, collection_id, parent_id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertRequest = db.prepare(`
    INSERT INTO requests (
      id, collection_id, folder_id, name, method, protocol, url,
      headers, params, body, auth, settings, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const col of collections) {
      const newColId = uuidv4();
      const now = new Date().toISOString();

      insertCollection.run(
        newColId,
        currentWsId,
        col.name || 'Imported Collection',
        col.description || '',
        now,
        now
      );

      // Recursive folder insertion
      const folderMap = new Map<string, string>(); // oldId -> newId

      const insertFoldersRecursively = (folders: any[], parentId: string | null) => {
        for (const f of folders || []) {
          const newFolderId = uuidv4();
          if (f.id) folderMap.set(f.id, newFolderId);

          insertFolder.run(
            newFolderId,
            newColId,
            parentId,
            f.name || 'Folder',
            now,
            now
          );

          // Requests inside folder
          for (const req of f.requests || []) {
            const newReqId = uuidv4();
            totalRequests++;
            insertRequest.run(
              newReqId,
              newColId,
              newFolderId,
              req.name || 'Request',
              req.method || 'GET',
              req.protocol || 'REST',
              req.url || '',
              JSON.stringify(req.headers || []),
              JSON.stringify(req.params || []),
              JSON.stringify(req.body || { type: 'none', raw: '' }),
              JSON.stringify(req.auth || { type: 'none' }),
              JSON.stringify(req.settings || { timeout: 0, followRedirects: true }),
              req.sort_order || 0,
              now,
              now
            );
          }

          if (f.children && f.children.length > 0) {
            insertFoldersRecursively(f.children, newFolderId);
          }
        }
      };

      insertFoldersRecursively(col.folders || [], null);

      // Direct collection requests (no folder)
      for (const req of col.requests || []) {
        const newReqId = uuidv4();
        totalRequests++;
        insertRequest.run(
          newReqId,
          newColId,
          null,
          req.name || 'Request',
          req.method || 'GET',
          req.protocol || 'REST',
          req.url || '',
          JSON.stringify(req.headers || []),
          JSON.stringify(req.params || []),
          JSON.stringify(req.body || { type: 'none', raw: '' }),
          JSON.stringify(req.auth || { type: 'none' }),
          JSON.stringify(req.settings || { timeout: 0, followRedirects: true }),
          req.sort_order || 0,
          now,
          now
        );
      }
    }
  });

  transaction();

  return {
    success: true,
    type: 'workspace',
    name: payload.workspace?.name || 'Workspace Backup',
    collectionsImported: collections.length,
    requestsImported: totalRequests,
  };
}

function importLocapiCollection(db: any, col: any, targetWsId: string): ImportResult {
  const res = importLocapiWorkspace(
    db,
    {
      workspace: { name: col.name || 'Collection Import' },
      collections: [col],
    },
    targetWsId
  );
  return {
    ...res,
    type: 'collection',
    name: col.name || 'Collection',
  };
}

function importPostmanCollection(db: any, postmanJson: any, targetWsId: string): ImportResult {
  const colName = postmanJson.info?.name || 'Imported Postman Collection';
  const colDesc =
    typeof postmanJson.info?.description === 'string'
      ? postmanJson.info.description
      : postmanJson.info?.description?.content || '';

  const newColId = uuidv4();
  const now = new Date().toISOString();
  let totalRequests = 0;

  const insertCollection = db.prepare(`
    INSERT INTO collections (id, workspace_id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertFolder = db.prepare(`
    INSERT INTO folders (id, collection_id, parent_id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertRequest = db.prepare(`
    INSERT INTO requests (
      id, collection_id, folder_id, name, method, protocol, url,
      headers, params, body, auth, settings, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const parsePostmanItem = (item: any, folderId: string | null) => {
    // If it's a folder (has nested item array and no request)
    if (Array.isArray(item.item) && !item.request) {
      const newFolderId = uuidv4();
      insertFolder.run(
        newFolderId,
        newColId,
        folderId,
        item.name || 'Folder',
        now,
        now
      );

      for (const child of item.item) {
        parsePostmanItem(child, newFolderId);
      }
      return;
    }

    // It's a request
    if (item.request) {
      totalRequests++;
      const reqObj = item.request;

      const name = item.name || 'Request';
      const method = (typeof reqObj === 'string' ? 'GET' : reqObj.method || 'GET').toUpperCase();

      // Extract URL
      let urlStr = '';
      const paramsList: any[] = [];
      if (typeof reqObj.url === 'string') {
        urlStr = reqObj.url;
      } else if (reqObj.url) {
        urlStr = reqObj.url.raw || '';
        if (Array.isArray(reqObj.url.query)) {
          for (const q of reqObj.url.query) {
            paramsList.push({
              id: uuidv4(),
              key: q.key || '',
              value: q.value || '',
              enabled: q.disabled !== true,
            });
          }
        }
      }

      // Extract Headers
      const headersList: any[] = [];
      if (Array.isArray(reqObj.header)) {
        for (const h of reqObj.header) {
          headersList.push({
            id: uuidv4(),
            key: h.key || '',
            value: h.value || '',
            enabled: h.disabled !== true,
          });
        }
      }

      // Extract Body
      let bodyType = 'none';
      let rawBody = '';
      let urlEncodedList: any[] = [];
      let formDataList: any[] = [];

      if (reqObj.body) {
        if (reqObj.body.mode === 'raw') {
          rawBody = reqObj.body.raw || '';
          bodyType = reqObj.body.options?.raw?.language === 'json' ? 'json' : 'raw';
        } else if (reqObj.body.mode === 'graphql' && reqObj.body.graphql) {
          bodyType = 'graphql';
          rawBody = reqObj.body.graphql.query || '';
        } else if (reqObj.body.mode === 'urlencoded' && Array.isArray(reqObj.body.urlencoded)) {
          bodyType = 'x-www-form-urlencoded';
          urlEncodedList = reqObj.body.urlencoded.map((u: any) => ({
            id: uuidv4(),
            key: u.key || '',
            value: u.value || '',
            enabled: u.disabled !== true,
          }));
        } else if (reqObj.body.mode === 'formdata' && Array.isArray(reqObj.body.formdata)) {
          bodyType = 'formData';
          formDataList = reqObj.body.formdata.map((fd: any) => ({
            id: uuidv4(),
            key: fd.key || '',
            value: fd.value || '',
            type: fd.type === 'file' ? 'file' : 'text',
            enabled: fd.disabled !== true,
            fileName: fd.src || undefined,
          }));
        }
      }

      // Extract Auth
      let authObj: any = { type: 'none' };
      if (reqObj.auth) {
        if (reqObj.auth.type === 'bearer' && Array.isArray(reqObj.auth.bearer)) {
          const tokenObj = reqObj.auth.bearer.find((b: any) => b.key === 'token');
          authObj = {
            type: 'bearer',
            bearer: { token: tokenObj ? tokenObj.value : '' },
          };
        } else if (reqObj.auth.type === 'basic' && Array.isArray(reqObj.auth.basic)) {
          const userObj = reqObj.auth.basic.find((b: any) => b.key === 'username');
          const passObj = reqObj.auth.basic.find((b: any) => b.key === 'password');
          authObj = {
            type: 'basic',
            basic: {
              username: userObj ? userObj.value : '',
              password: passObj ? passObj.value : '',
            },
          };
        }
      }

      const newReqId = uuidv4();
      insertRequest.run(
        newReqId,
        newColId,
        folderId,
        name,
        method,
        bodyType === 'graphql' ? 'GRAPHQL' : 'REST',
        urlStr,
        JSON.stringify(headersList),
        JSON.stringify(paramsList),
        JSON.stringify({
          type: bodyType,
          raw: rawBody,
          urlEncoded: urlEncodedList,
          formData: formDataList,
        }),
        JSON.stringify(authObj),
        JSON.stringify({ timeout: 0, followRedirects: true }),
        totalRequests,
        now,
        now
      );
    }
  };

  const transaction = db.transaction(() => {
    insertCollection.run(newColId, targetWsId, colName, colDesc, now, now);
    for (const topItem of postmanJson.item || []) {
      parsePostmanItem(topItem, null);
    }
  });

  transaction();

  return {
    success: true,
    type: 'postman',
    name: colName,
    collectionsImported: 1,
    requestsImported: totalRequests,
  };
}

function importOpenApiSpec(db: any, spec: any, targetWsId: string): ImportResult {
  const title = spec.info?.title || 'Imported OpenAPI Spec';
  const description =
    typeof spec.info?.description === 'string' ? spec.info.description : '';
  const newColId = uuidv4();
  const now = new Date().toISOString();

  let baseUrl = '';
  if (Array.isArray(spec.servers) && spec.servers.length > 0) {
    baseUrl = spec.servers[0].url || '';
  } else if (spec.host) {
    const scheme = (spec.schemes && spec.schemes[0]) || 'https';
    baseUrl = `${scheme}://${spec.host}${spec.basePath || ''}`;
  }

  const insertCollection = db.prepare(`
    INSERT INTO collections (id, workspace_id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertFolder = db.prepare(`
    INSERT INTO folders (id, collection_id, parent_id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertRequest = db.prepare(`
    INSERT INTO requests (
      id, collection_id, folder_id, name, method, protocol, url,
      headers, params, body, auth, settings, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tagFolderMap = new Map<string, string>();
  let totalRequests = 0;

  const transaction = db.transaction(() => {
    insertCollection.run(newColId, targetWsId, title, description, now, now);

    if (Array.isArray(spec.tags)) {
      for (const t of spec.tags) {
        if (t.name) {
          const folderId = uuidv4();
          insertFolder.run(folderId, newColId, null, t.name, now, now);
          tagFolderMap.set(t.name, folderId);
        }
      }
    }

    const paths = spec.paths || {};
    const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];

    for (const [pathStr, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      for (const methodKey of Object.keys(pathItem)) {
        const methodLower = methodKey.toLowerCase();
        if (!httpMethods.includes(methodLower)) continue;

        const op = (pathItem as any)[methodKey];
        if (!op || typeof op !== 'object') continue;

        totalRequests++;
        const methodUpper = methodKey.toUpperCase();
        const reqName = op.summary || op.operationId || `${methodUpper} ${pathStr}`;

        let targetFolderId: string | null = null;
        if (Array.isArray(op.tags) && op.tags.length > 0) {
          const firstTag = op.tags[0];
          if (!tagFolderMap.has(firstTag)) {
            const folderId = uuidv4();
            insertFolder.run(folderId, newColId, null, firstTag, now, now);
            tagFolderMap.set(firstTag, folderId);
          }
          targetFolderId = tagFolderMap.get(firstTag) || null;
        }

        const fullUrl = baseUrl
          ? `${baseUrl.replace(/\/$/, '')}/${pathStr.replace(/^\//, '')}`
          : pathStr;

        const allParams = [
          ...((pathItem as any).parameters || []),
          ...(op.parameters || []),
        ];
        const paramsList: any[] = [];
        const headersList: any[] = [];

        for (const p of allParams) {
          if (p.in === 'query') {
            paramsList.push({
              id: uuidv4(),
              key: p.name || '',
              value: p.example || p.schema?.default || '',
              enabled: p.required ?? true,
            });
          } else if (p.in === 'header') {
            headersList.push({
              id: uuidv4(),
              key: p.name || '',
              value: p.example || p.schema?.default || '',
              enabled: p.required ?? true,
            });
          }
        }

        let bodyType = 'none';
        let rawBody = '';
        if (op.requestBody?.content) {
          if (op.requestBody.content['application/json']) {
            bodyType = 'json';
            const schema = op.requestBody.content['application/json'].schema || {};
            const example = op.requestBody.content['application/json'].example;
            rawBody = example ? JSON.stringify(example, null, 2) : JSON.stringify(schema, null, 2);
          }
        }

        insertRequest.run(
          uuidv4(),
          newColId,
          targetFolderId,
          reqName,
          methodUpper,
          'REST',
          fullUrl,
          JSON.stringify(headersList),
          JSON.stringify(paramsList),
          JSON.stringify({ type: bodyType, raw: rawBody }),
          JSON.stringify({ type: 'none' }),
          JSON.stringify({ timeout: 0, followRedirects: true }),
          totalRequests,
          now,
          now
        );
      }
    }
  });

  transaction();

  return {
    success: true,
    type: 'collection',
    name: title,
    collectionsImported: 1,
    requestsImported: totalRequests,
  };
}

// 4. Native OS Save File Dialog
export async function showSaveFileDialog(
  defaultName: string,
  content: string,
  targetWindow?: BrowserWindow
): Promise<{ success: boolean; filePath?: string }> {
  const win = targetWindow || BrowserWindow.getFocusedWindow();
  const options: any = {
    title: 'Export File',
    defaultPath: defaultName,
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  };

  const result = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options);

  if (result.canceled || !result.filePath) {
    return { success: false };
  }

  fs.writeFileSync(result.filePath, content, 'utf-8');
  return { success: true, filePath: result.filePath };
}

// 5. Native OS Open File Dialog
export async function showOpenFileDialog(
  targetWindow?: BrowserWindow
): Promise<{ filename: string; content: string } | null> {
  const win = targetWindow || BrowserWindow.getFocusedWindow();
  const options: any = {
    title: 'Import File',
    properties: ['openFile'],
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  };

  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const filename = filePath.split(/[/\\]/).pop() || 'import.json';
  const content = fs.readFileSync(filePath, 'utf-8');

  return { filename, content };
}
