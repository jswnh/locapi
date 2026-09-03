import { getDb } from '../client';
import { v4 as uuidv4 } from 'uuid';
import { HistoryItem, ApiProtocol } from '../../types/db';

interface RawHistoryRow {
  id: string;
  request_id: string | null;
  method: string;
  protocol: string;
  url: string;
  status: number | null;
  status_text: string | null;
  duration_ms: number | null;
  size_bytes: number | null;
  request_snapshot: string;
  response_snapshot: string;
  executed_at: string;
}

function parseHistoryRow(row: RawHistoryRow): HistoryItem {
  return {
    ...row,
    protocol: row.protocol as ApiProtocol,
    request_snapshot: JSON.parse(row.request_snapshot || '{}'),
    response_snapshot: JSON.parse(row.response_snapshot || '{}'),
  };
}

export function listHistory(limit = 100): HistoryItem[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM history ORDER BY executed_at DESC LIMIT ?').all(limit) as RawHistoryRow[];
  return rows.map(parseHistoryRow);
}

export function addHistory(data: Partial<HistoryItem>): HistoryItem {
  const db = getDb();
  const id = data.id || uuidv4();
  const now = data.executed_at || new Date().toISOString();

  const requestId = data.request_id || null;
  const method = data.method || 'GET';
  const protocol = data.protocol || 'REST';
  const url = data.url || '';
  const status = data.status ?? null;
  const statusText = data.status_text || null;
  const durationMs = data.duration_ms ?? null;
  const sizeBytes = data.size_bytes ?? null;
  const requestSnapshot = JSON.stringify(data.request_snapshot || {});
  const responseSnapshot = JSON.stringify(data.response_snapshot || {});

  db.prepare(`
    INSERT INTO history (
      id, request_id, method, protocol, url, status, status_text,
      duration_ms, size_bytes, request_snapshot, response_snapshot, executed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    requestId,
    method,
    protocol,
    url,
    status,
    statusText,
    durationMs,
    sizeBytes,
    requestSnapshot,
    responseSnapshot,
    now
  );

  return {
    id,
    request_id: requestId,
    method,
    protocol,
    url,
    status,
    status_text: statusText,
    duration_ms: durationMs,
    size_bytes: sizeBytes,
    request_snapshot: data.request_snapshot || {},
    response_snapshot: data.response_snapshot || {},
    executed_at: now,
  };
}

export function clearHistory(): boolean {
  const db = getDb();
  db.prepare('DELETE FROM history').run();
  return true;
}
