import { getDb } from '../client';
import { v4 as uuidv4 } from 'uuid';
import { ApiRequest, HttpMethod, ApiProtocol } from '../../types/db';

interface RawRequestRow {
  id: string;
  collection_id: string | null;
  folder_id: string | null;
  name: string;
  method: string;
  protocol: string;
  url: string;
  headers: string;
  params: string;
  body: string;
  auth: string;
  settings: string;
  scripts?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function parseRequestRow(row: RawRequestRow): ApiRequest {
  return {
    ...row,
    method: row.method as HttpMethod,
    protocol: row.protocol as ApiProtocol,
    headers: JSON.parse(row.headers || '[]'),
    params: JSON.parse(row.params || '[]'),
    body: JSON.parse(row.body || '{"type":"none","raw":""}'),
    auth: JSON.parse(row.auth || '{"type":"none"}'),
    settings: JSON.parse(row.settings || '{"timeout":0,"followRedirects":true}'),
    scripts: (row as any).scripts ? JSON.parse((row as any).scripts) : { preRequest: '', test: '' },
  };
}

export function getRequest(id: string): ApiRequest | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM requests WHERE id = ?').get(id) as RawRequestRow | undefined;
  if (!row) return null;
  return parseRequestRow(row);
}

export function createRequest(data: Partial<ApiRequest>): ApiRequest {
  const db = getDb();
  const id = data.id || uuidv4();
  const now = new Date().toISOString();

  const method = data.method || 'GET';
  const protocol = data.protocol || 'REST';
  const name = (data.name || 'New Request').trim();
  const url = data.url || '';
  const headers = JSON.stringify(data.headers || []);
  const params = JSON.stringify(data.params || []);
  const body = JSON.stringify(data.body || { type: 'none', raw: '' });
  const auth = JSON.stringify(data.auth || { type: 'none' });
  const settings = JSON.stringify(data.settings || { timeout: 0, followRedirects: true });
  const scripts = JSON.stringify(data.scripts || { preRequest: '', test: '' });
  const sortOrder = data.sort_order ?? 0;

  db.prepare(`
    INSERT INTO requests (
      id, collection_id, folder_id, name, method, protocol, url,
      headers, params, body, auth, settings, scripts, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.collection_id || null,
    data.folder_id || null,
    name,
    method,
    protocol,
    url,
    headers,
    params,
    body,
    auth,
    settings,
    scripts,
    sortOrder,
    now,
    now
  );

  return {
    id,
    collection_id: data.collection_id || null,
    folder_id: data.folder_id || null,
    name,
    method,
    protocol,
    url,
    headers: data.headers || [],
    params: data.params || [],
    body: data.body || { type: 'none', raw: '' },
    auth: data.auth || { type: 'none' },
    settings: data.settings || { timeout: 0, followRedirects: true },
    scripts: data.scripts || { preRequest: '', test: '' },
    sort_order: sortOrder,
    created_at: now,
    updated_at: now,
  };
}

export function updateRequest(id: string, data: Partial<ApiRequest>): ApiRequest | null {
  const db = getDb();
  const existing = getRequest(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const name = data.name !== undefined ? data.name.trim() : existing.name;
  const method = data.method !== undefined ? data.method : existing.method;
  const protocol = data.protocol !== undefined ? data.protocol : existing.protocol;
  const url = data.url !== undefined ? data.url : existing.url;
  const collectionId = data.collection_id !== undefined ? data.collection_id : existing.collection_id;
  const folderId = data.folder_id !== undefined ? data.folder_id : existing.folder_id;
  const headers = data.headers !== undefined ? JSON.stringify(data.headers) : JSON.stringify(existing.headers);
  const params = data.params !== undefined ? JSON.stringify(data.params) : JSON.stringify(existing.params);
  const body = data.body !== undefined ? JSON.stringify(data.body) : JSON.stringify(existing.body);
  const auth = data.auth !== undefined ? JSON.stringify(data.auth) : JSON.stringify(existing.auth);
  const settings = data.settings !== undefined ? JSON.stringify(data.settings) : JSON.stringify(existing.settings);
  const scripts = data.scripts !== undefined ? JSON.stringify(data.scripts) : JSON.stringify(existing.scripts || { preRequest: '', test: '' });
  const sortOrder = data.sort_order !== undefined ? data.sort_order : existing.sort_order;

  db.prepare(`
    UPDATE requests
    SET name = ?, method = ?, protocol = ?, url = ?, collection_id = ?, folder_id = ?,
        headers = ?, params = ?, body = ?, auth = ?, settings = ?, scripts = ?, sort_order = ?, updated_at = ?
    WHERE id = ?
  `).run(
    name,
    method,
    protocol,
    url,
    collectionId,
    folderId,
    headers,
    params,
    body,
    auth,
    settings,
    scripts,
    sortOrder,
    now,
    id
  );

  return getRequest(id);
}

export function deleteRequest(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM requests WHERE id = ?').run(id);
  return result.changes > 0;
}

export function duplicateRequest(id: string): ApiRequest | null {
  const existing = getRequest(id);
  if (!existing) return null;

  return createRequest({
    ...existing,
    id: uuidv4(),
    name: `${existing.name} (Copy)`,
  });
}

export function reorderRequests(
  items: { id: string; sort_order: number; folder_id?: string | null; collection_id?: string | null }[]
): boolean {
  const db = getDb();
  const updateStmt = db.prepare(`
    UPDATE requests
    SET sort_order = ?,
        folder_id = COALESCE(?, folder_id),
        collection_id = COALESCE(?, collection_id),
        updated_at = ?
    WHERE id = ?
  `);

  const now = new Date().toISOString();
  const tx = db.transaction((rows: typeof items) => {
    for (const row of rows) {
      updateStmt.run(row.sort_order, row.folder_id !== undefined ? row.folder_id : null, row.collection_id !== undefined ? row.collection_id : null, now, row.id);
    }
  });

  tx(items);
  return true;
}
