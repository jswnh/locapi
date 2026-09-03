import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return dbInstance;
}

export function initDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  const dbPath = path.join(userDataPath, 'locapi.db');
  console.log(`[Database] Initializing SQLite database at: ${dbPath}`);

  dbInstance = new Database(dbPath);

  // Performance optimizations
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('synchronous = NORMAL');

  // Create tables
  dbInstance.exec(`
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
      color TEXT DEFAULT '#0275E2',
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

    CREATE INDEX IF NOT EXISTS idx_folders_collection ON folders(collection_id);
    CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
    CREATE INDEX IF NOT EXISTS idx_requests_collection ON requests(collection_id);
    CREATE INDEX IF NOT EXISTS idx_requests_folder ON requests(folder_id);
    CREATE INDEX IF NOT EXISTS idx_history_executed_at ON history(executed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cookies_domain ON cookies(domain);
  `);

  // Run schema migrations for existing databases
  runMigrations(dbInstance);

  // Seed default data if database is fresh
  seedDefaults(dbInstance);

  return dbInstance;
}

function runMigrations(db: Database.Database) {
  // 1. Ensure collections has workspace_id column
  const cols = db.prepare(`PRAGMA table_info(collections)`).all() as Array<{ name: string }>;
  const hasWorkspaceId = cols.some((c) => c.name === 'workspace_id');
  if (!hasWorkspaceId) {
    console.log('[Migration] Adding workspace_id column to collections table...');
    db.exec(`ALTER TABLE collections ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE`);
  }
  // 2. Now safely create the index
  db.exec(`CREATE INDEX IF NOT EXISTS idx_collections_workspace ON collections(workspace_id)`);

  // 2.5 Ensure collections has color column
  const hasColor = cols.some((c) => c.name === 'color');
  if (!hasColor) {
    console.log('[Migration] Adding color column to collections table...');
    db.exec(`ALTER TABLE collections ADD COLUMN color TEXT DEFAULT '#0275E2'`);
  }

  // 3. Ensure cookies table exists for existing databases
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_cookies_domain ON cookies(domain);
  `);

  // 4. Ensure requests has scripts column
  const reqCols = db.prepare(`PRAGMA table_info(requests)`).all() as Array<{ name: string }>;
  const hasScripts = reqCols.some((c) => c.name === 'scripts');
  if (!hasScripts) {
    console.log('[Migration] Adding scripts column to requests table...');
    db.exec(`ALTER TABLE requests ADD COLUMN scripts TEXT NOT NULL DEFAULT '{"preRequest":"","test":""}'`);
  }
}

function seedDefaults(db: Database.Database) {
  const now = new Date().toISOString();

  // 1. Ensure at least one Workspace exists
  let defaultWorkspace = db.prepare('SELECT * FROM workspaces WHERE is_active = 1 LIMIT 1').get() as any;
  if (!defaultWorkspace) {
    const existingWs = db.prepare('SELECT * FROM workspaces ORDER BY created_at ASC LIMIT 1').get() as any;
    if (existingWs) {
      db.prepare('UPDATE workspaces SET is_active = 1 WHERE id = ?').run(existingWs.id);
      defaultWorkspace = existingWs;
    } else {
      const wsId = uuidv4();
      db.prepare(`
        INSERT INTO workspaces (id, name, description, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(wsId, 'Personal Workspace', 'Default personal developer workspace', 1, now, now);
      defaultWorkspace = { id: wsId, name: 'Personal Workspace' };
      console.log('[Database] Seeded initial Personal Workspace');
    }
  }

  // 2. Link any orphan collections to default workspace
  db.prepare(`
    UPDATE collections
    SET workspace_id = ?
    WHERE workspace_id IS NULL OR workspace_id = ''
  `).run(defaultWorkspace.id);

  // 3. Seed starter collections if completely empty
  const collectionCount = db.prepare('SELECT COUNT(*) as count FROM collections').get() as { count: number };
  if (collectionCount.count === 0) {
    const collectionId = uuidv4();
    const requestId = uuidv4();

    const insertCollection = db.prepare(`
      INSERT INTO collections (id, workspace_id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertRequest = db.prepare(`
      INSERT INTO requests (
        id, collection_id, folder_id, name, method, protocol, url,
        headers, params, body, auth, settings, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertCollection.run(collectionId, defaultWorkspace.id, 'Sample API Collection', 'Ready-to-test starter requests', now, now);

    insertRequest.run(
      requestId,
      collectionId,
      null,
      'Get Random Quote',
      'GET',
      'REST',
      'https://dummyjson.com/quotes/random',
      JSON.stringify([
        { id: uuidv4(), key: 'Accept', value: 'application/json', enabled: true }
      ]),
      JSON.stringify([]),
      JSON.stringify({ type: 'none', raw: '' }),
      JSON.stringify({ type: 'none' }),
      JSON.stringify({ timeout: 10000, followRedirects: true }),
      0,
      now,
      now
    );

    // Seed default environment
    const envId = uuidv4();
    const insertEnv = db.prepare(`
      INSERT INTO environments (id, name, variables, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertEnv.run(
      envId,
      'Development',
      JSON.stringify([
        { id: uuidv4(), key: 'baseUrl', value: 'https://dummyjson.com', enabled: true },
        { id: uuidv4(), key: 'apiKey', value: 'locapi_dev_sample_token', enabled: true }
      ]),
      1,
      now,
      now
    );

    console.log('[Database] Seeded initial sample collection, request, and environment');
  }
}
