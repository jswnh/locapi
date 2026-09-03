import { getDb } from '../client';
import { v4 as uuidv4 } from 'uuid';
import { Environment, EnvironmentVariable } from '../../types/db';

interface RawEnvironmentRow {
  id: string;
  name: string;
  variables: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function parseEnvironmentRow(row: RawEnvironmentRow): Environment {
  return {
    id: row.id,
    name: row.name,
    variables: JSON.parse(row.variables || '[]'),
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function listEnvironments(): Environment[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM environments ORDER BY created_at ASC').all() as RawEnvironmentRow[];
  return rows.map(parseEnvironmentRow);
}

export function createEnvironment(name: string, variables: EnvironmentVariable[] = []): Environment {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO environments (id, name, variables, is_active, created_at, updated_at)
    VALUES (?, ?, ?, 0, ?, ?)
  `).run(id, name.trim(), JSON.stringify(variables), now, now);

  return {
    id,
    name: name.trim(),
    variables,
    is_active: false,
    created_at: now,
    updated_at: now,
  };
}

export function updateEnvironment(id: string, data: Partial<Environment>): Environment | null {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM environments WHERE id = ?').get(id) as RawEnvironmentRow | undefined;
  if (!rows) return null;

  const existing = parseEnvironmentRow(rows);
  const now = new Date().toISOString();

  const name = data.name !== undefined ? data.name.trim() : existing.name;
  const variables = data.variables !== undefined ? JSON.stringify(data.variables) : JSON.stringify(existing.variables);
  const isActive = data.is_active !== undefined ? (data.is_active ? 1 : 0) : (existing.is_active ? 1 : 0);

  db.prepare(`
    UPDATE environments
    SET name = ?, variables = ?, is_active = ?, updated_at = ?
    WHERE id = ?
  `).run(name, variables, isActive, now, id);

  const updated = db.prepare('SELECT * FROM environments WHERE id = ?').get(id) as RawEnvironmentRow;
  return parseEnvironmentRow(updated);
}

export function setActiveEnvironment(id: string | null): boolean {
  const db = getDb();
  // Deactivate all first
  db.prepare('UPDATE environments SET is_active = 0').run();
  if (id) {
    db.prepare('UPDATE environments SET is_active = 1 WHERE id = ?').run(id);
  }
  return true;
}

export function deleteEnvironment(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM environments WHERE id = ?').run(id);
  return result.changes > 0;
}
