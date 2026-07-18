import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = process.env.LOCAL_DB_PATH || path.join(process.cwd(), 'data', 'manifest-diary.sqlite');
mkdirSync(path.dirname(dbPath), { recursive: true });

export const localDb = new DatabaseSync(dbPath);
localDb.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS life_logs (
    id TEXT PRIMARY KEY, entry_date TEXT NOT NULL, type TEXT NOT NULL,
    start_at TEXT, end_at TEXT, value REAL, unit TEXT, content TEXT,
    metadata TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_life_logs_date ON life_logs(entry_date DESC);
`);

export function getSetting(key: string): string | null {
  return (localDb.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value?: string } | undefined)?.value ?? null;
}
export function setSetting(key: string, value: string) {
  localDb.prepare('INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value);
}
