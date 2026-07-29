import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = process.env.LOCAL_DB_PATH || path.join(process.cwd(), 'data', 'manifest-diary.sqlite');
mkdirSync(path.dirname(dbPath), { recursive: true });

export const localDb = new DatabaseSync(dbPath);

function migrate() {
  localDb.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#5EEAD4',
      target_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date TEXT,
      position REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      title TEXT NOT NULL,
      is_done INTEGER NOT NULL DEFAULT 0,
      position REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      minutes INTEGER NOT NULL,
      logged_date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_projects_status_updated
      ON projects(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tasks_project_status
      ON tasks(project_id, status, position);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date
      ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_subtasks_task_position
      ON subtasks(task_id, position);
    CREATE INDEX IF NOT EXISTS idx_time_entries_task
      ON time_entries(task_id, logged_date);
    CREATE INDEX IF NOT EXISTS idx_time_entries_logged_date
      ON time_entries(logged_date);

    CREATE TABLE IF NOT EXISTS project_time_entries (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      minutes INTEGER NOT NULL,
      logged_date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_project_time_project
      ON project_time_entries(project_id, logged_date);
  `);

  // Additive column migration: start_date on projects (older dbs predate it).
  {
    const cols = localDb.prepare('PRAGMA table_info(projects)').all() as { name: string }[];
    if (!cols.some((c) => c.name === 'start_date')) {
      localDb.exec('ALTER TABLE projects ADD COLUMN start_date TEXT');
    }
  }

  // Drop legacy local business tables from previous product lines.
  localDb.exec(`
    DROP TABLE IF EXISTS life_logs;
    DROP TABLE IF EXISTS journal_entries;
    DROP TABLE IF EXISTS manifest_entries;
    DROP TABLE IF EXISTS witness_entries;
  `);
}

migrate();

export function getSetting(key: string): string | null {
  return (
    (localDb.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value?: string } | undefined)
      ?.value ?? null
  );
}

export function setSetting(key: string, value: string) {
  localDb
    .prepare(
      'INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    )
    .run(key, value);
}

export function nowIso() {
  return new Date().toISOString();
}
