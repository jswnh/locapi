import { getDb } from '../client';
import { v4 as uuidv4 } from 'uuid';
import { Collection, Folder, ApiRequest } from '../../types/db';

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
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function parseRequestRow(row: RawRequestRow): ApiRequest {
  return {
    ...row,
    method: row.method as any,
    protocol: row.protocol as any,
    headers: JSON.parse(row.headers || '[]'),
    params: JSON.parse(row.params || '[]'),
    body: JSON.parse(row.body || '{"type":"none","raw":""}'),
    auth: JSON.parse(row.auth || '{"type":"none"}'),
    settings: JSON.parse(row.settings || '{"timeout":0,"followRedirects":true}'),
  };
}

export function listCollections(workspaceId?: string): Collection[] {
  const db = getDb();

  let targetWsId = workspaceId;
  if (!targetWsId) {
    const activeWs = db.prepare('SELECT id FROM workspaces WHERE is_active = 1 LIMIT 1').get() as any;
    if (activeWs) {
      targetWsId = activeWs.id;
    }
  }

  const rawCollections = targetWsId
    ? (db.prepare('SELECT * FROM collections WHERE workspace_id = ? ORDER BY created_at ASC').all(targetWsId) as any[])
    : (db.prepare('SELECT * FROM collections ORDER BY created_at ASC').all() as any[]);

  const rawFolders = db.prepare('SELECT * FROM folders ORDER BY created_at ASC').all() as {
    id: string;
    collection_id: string;
    parent_id: string | null;
    name: string;
    created_at: string;
    updated_at: string;
  }[];

  const rawRequests = db.prepare('SELECT * FROM requests ORDER BY sort_order ASC, created_at ASC').all() as RawRequestRow[];
  const parsedRequests = rawRequests.map(parseRequestRow);

  return rawCollections.map((col) => {
    // Top-level requests directly under this collection (folder_id is null)
    const directRequests = parsedRequests.filter(
      (r) => r.collection_id === col.id && (!r.folder_id || r.folder_id === '')
    );

    // Folders belonging to this collection
    const collectionFolders = rawFolders.filter((f) => f.collection_id === col.id);

    // Build nested folder hierarchy
    const buildFolderTree = (parentId: string | null): Folder[] => {
      return collectionFolders
        .filter((f) => f.parent_id === parentId)
        .map((f) => ({
          ...f,
          requests: parsedRequests.filter((r) => r.folder_id === f.id),
          children: buildFolderTree(f.id),
        }));
    };

    return {
      ...col,
      folders: buildFolderTree(null),
      requests: directRequests,
    };
  });
}

export function getCollection(id: string): Collection | null {
  const db = getDb();
  const col = db.prepare('SELECT * FROM collections WHERE id = ?').get(id) as any;
  if (!col) return null;
  const all = listCollections(col.workspace_id);
  return all.find((c) => c.id === id) || null;
}

export function createCollection(data: { name: string; description?: string; color?: string; workspaceId?: string }): Collection {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const color = data.color || '#0275E2';

  let wsId = data.workspaceId;
  if (!wsId) {
    const activeWs = db.prepare('SELECT id FROM workspaces WHERE is_active = 1 LIMIT 1').get() as any;
    if (activeWs) {
      wsId = activeWs.id;
    }
  }

  db.prepare(`
    INSERT INTO collections (id, workspace_id, name, description, color, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, wsId || null, data.name.trim(), (data.description || '').trim(), color, now, now);

  return {
    id,
    workspace_id: wsId || null,
    name: data.name.trim(),
    description: (data.description || '').trim(),
    color,
    created_at: now,
    updated_at: now,
    folders: [],
    requests: [],
  };
}

export function updateCollection(id: string, data: { name?: string; description?: string; color?: string }): Collection | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM collections WHERE id = ?').get(id) as any;
  if (!existing) return null;

  const now = new Date().toISOString();
  const name = data.name !== undefined ? data.name.trim() : existing.name;
  const description = data.description !== undefined ? data.description.trim() : existing.description;
  const color = data.color !== undefined ? data.color : existing.color;

  db.prepare(`
    UPDATE collections
    SET name = ?, description = ?, color = ?, updated_at = ?
    WHERE id = ?
  `).run(name, description, color, now, id);

  return getCollection(id);
}

export function deleteCollection(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM collections WHERE id = ?').run(id);
  return result.changes > 0;
}

export function createFolder(data: { collectionId: string; parentId?: string | null; name: string }): Folder {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO folders (id, collection_id, parent_id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, data.collectionId, data.parentId || null, data.name.trim(), now, now);

  return {
    id,
    collection_id: data.collectionId,
    parent_id: data.parentId || null,
    name: data.name.trim(),
    created_at: now,
    updated_at: now,
    requests: [],
    children: [],
  };
}

export function updateFolder(id: string, data: { name: string }): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE folders
    SET name = ?, updated_at = ?
    WHERE id = ?
  `).run(data.name.trim(), now, id);

  return result.changes > 0;
}

export function deleteFolder(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM folders WHERE id = ?').run(id);
  return result.changes > 0;
}
