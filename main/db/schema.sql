PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_active INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  workspace_id TEXT DEFAULT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  parent_id TEXT DEFAULT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  collection_id TEXT DEFAULT NULL,
  folder_id TEXT DEFAULT NULL,
  name TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  protocol TEXT NOT NULL DEFAULT 'REST',
  url TEXT NOT NULL DEFAULT '',
  headers TEXT NOT NULL DEFAULT '[]',
  params TEXT NOT NULL DEFAULT '[]',
  body TEXT NOT NULL DEFAULT '{"type":"none","raw":""}',
  auth TEXT NOT NULL DEFAULT '{"type":"none"}',
  settings TEXT NOT NULL DEFAULT '{"timeout":0,"followRedirects":true}',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS environments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  variables TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS history (
  id TEXT PRIMARY KEY,
  request_id TEXT DEFAULT NULL,
  method TEXT NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'REST',
  url TEXT NOT NULL,
  status INTEGER,
  status_text TEXT,
  duration_ms INTEGER,
  size_bytes INTEGER,
  request_snapshot TEXT NOT NULL DEFAULT '{}',
  response_snapshot TEXT NOT NULL DEFAULT '{}',
  executed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cookies (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '/',
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  expires TEXT DEFAULT NULL,
  http_only INTEGER NOT NULL DEFAULT 0,
  secure INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_collections_workspace ON collections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_folders_collection ON folders(collection_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_requests_collection ON requests(collection_id);
CREATE INDEX IF NOT EXISTS idx_requests_folder ON requests(folder_id);
CREATE INDEX IF NOT EXISTS idx_history_executed_at ON history(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cookies_domain ON cookies(domain);
