import { getDb } from '../client';
import { Workspace } from '../../types/db';
import { v4 as uuidv4 } from 'uuid';

export function listWorkspaces(): Workspace[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM workspaces ORDER BY created_at ASC').all() as any[];
  return rows.map((r) => ({
    ...r,
    is_active: Boolean(r.is_active),
  }));
}

export function getActiveWorkspace(): Workspace | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM workspaces WHERE is_active = 1 LIMIT 1').get() as any;
  if (!row) {
    const first = db.prepare('SELECT * FROM workspaces ORDER BY created_at ASC LIMIT 1').get() as any;
    if (first) {
      db.prepare('UPDATE workspaces SET is_active = 1 WHERE id = ?').run(first.id);
      return { ...first, is_active: true };
    }
    return null;
  }
  return { ...row, is_active: true };
}

export function createWorkspace(data: { name: string; description?: string }): Workspace {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  // If this is the first workspace, make it active
  const count = (db.prepare('SELECT count(*) as count FROM workspaces').get() as any).count;
  const isActive = count === 0 ? 1 : 0;

  db.prepare(`
    INSERT INTO workspaces (id, name, description, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, data.name, data.description || '', isActive, now, now);

  return {
    id,
    name: data.name,
    description: data.description || '',
    is_active: Boolean(isActive),
    created_at: now,
    updated_at: now,
  };
}

export function updateWorkspace(
  id: string,
  data: { name?: string; description?: string }
): Workspace | null {
  const db = getDb();
  const now = new Date().toISOString();

  const current = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as any;
  if (!current) return null;

  const name = data.name !== undefined ? data.name : current.name;
  const description = data.description !== undefined ? data.description : current.description;

  db.prepare(`
    UPDATE workspaces
    SET name = ?, description = ?, updated_at = ?
    WHERE id = ?
  `).run(name, description, now, id);

  return {
    ...current,
    name,
    description,
    is_active: Boolean(current.is_active),
    updated_at: now,
  };
}

export function setActiveWorkspace(id: string): boolean {
  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare('UPDATE workspaces SET is_active = 0').run();
    db.prepare('UPDATE workspaces SET is_active = 1 WHERE id = ?').run(id);
  });
  transaction();
  return true;
}

export function deleteWorkspace(id: string): boolean {
  const db = getDb();
  // Don't allow deleting if it's the only workspace
  const count = (db.prepare('SELECT count(*) as count FROM workspaces').get() as any).count;
  if (count <= 1) return false;

  const target = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as any;
  if (!target) return false;

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);

    // If active workspace was deleted, set first remaining as active
    if (target.is_active) {
      const first = db.prepare('SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1').get() as any;
      if (first) {
        db.prepare('UPDATE workspaces SET is_active = 1 WHERE id = ?').run(first.id);
      }
    }
  });

  transaction();
  return true;
}
