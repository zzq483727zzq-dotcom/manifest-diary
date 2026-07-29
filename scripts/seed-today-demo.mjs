/**
 * Demo seed for Today desk visual QA. Appends only; never deletes.
 * Usage: node scripts/seed-today-demo.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'manifest-diary.sqlite');
const db = new DatabaseSync(dbPath);

const now = new Date();
const today = now.toISOString().slice(0, 10);
const nowS = now.toISOString().replace(/\.\d{3}Z$/, '');
const addDays = (n) => {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const colors = ['#5EEAD4', '#7DD3FC', '#C4B5FD', '#FBBF24'];
const projectSpecs = [
  ['作品集网站重做', '把旧作品集改成可演示的个人执行系统作品', colors[0], addDays(21)],
  ['算法面试准备', '本月完成高频题与复盘笔记', colors[1], addDays(30)],
  ['开源小工具', '本地备份 CLI 的 MVP', colors[2], addDays(45)],
];

const existing = db.prepare(`SELECT id, name FROM projects WHERE status = 'active' ORDER BY updated_at DESC`).all();
const pids = existing.map((r) => r.id);

// Rename garbled first project if needed
if (existing[0] && /[^一-鿿A-Za-z0-9]/.test(existing[0].name) && existing[0].name.length <= 20) {
  // keep id, fix name when it looks broken (mojibake often has replacement or weird bytes)
}

// Always ensure three named demo projects by inserting missing titles
for (const [name, description, color, target] of projectSpecs) {
  const hit = db.prepare(`SELECT id FROM projects WHERE name = ?`).get(name);
  if (hit) {
    if (!pids.includes(hit.id)) pids.push(hit.id);
    continue;
  }
  const id = randomUUID();
  db.prepare(
    `INSERT INTO projects(id,name,description,color,target_date,status,created_at,updated_at,completed_at)
     VALUES(?,?,?,?,?,'active',?,?,NULL)`,
  ).run(id, name, description, color, target, nowS, nowS);
  pids.push(id);
  console.log('project+', name);
}

// Prefer the three demo project ids in order if present
const ordered = projectSpecs
  .map(([name]) => db.prepare(`SELECT id FROM projects WHERE name = ?`).get(name)?.id)
  .filter(Boolean);
const use = ordered.length === 3 ? ordered : pids;

const demos = [
  [use[0], '首页信息架构定稿', 'todo', 'high', addDays(-2), 0],
  [use[0], '设计 token 收敛到 DESIGN.md', 'todo', 'high', addDays(-1), 0],
  [use[1] || use[0], '完成 10 道双指针题', 'todo', 'high', today, 45],
  [use[0], '今日台对照 mock 验收', 'in_progress', 'high', today, 90],
  [use[1] || use[0], '整理错题本模板', 'todo', 'high', addDays(2), 0],
  [use[2] || use[0], 'CLI 参数解析草案', 'todo', 'high', addDays(3), 0],
  [use[0], '项目列表空状态插图', 'in_progress', 'medium', addDays(5), 30],
  [use[2] || use[0], 'SQLite 备份命令骨架', 'in_progress', 'medium', null, 60],
  [use[1] || use[0], '本周复习链表', 'completed', 'medium', addDays(-1), 80],
  [use[0], '路由与壳层迁移', 'completed', 'high', addDays(-2), 120],
];

let i = 0;
for (const [projectId, title, status, priority, due, minutes] of demos) {
  if (!projectId) continue;
  if (db.prepare(`SELECT 1 FROM tasks WHERE title = ?`).get(title)) continue;
  const id = randomUUID();
  const completedAt =
    status === 'completed'
      ? new Date(Date.now() - (i % 3) * 86400000).toISOString().replace(/\.\d{3}Z$/, '')
      : null;
  db.prepare(
    `INSERT INTO tasks(id,project_id,title,description,status,priority,due_date,position,created_at,updated_at,completed_at)
     VALUES(?,?,?,'',?,?,?,?,?,?,?)`,
  ).run(id, projectId, title, status, priority, due, 200 + i, nowS, nowS, completedAt);
  if (minutes > 0) {
    db.prepare(
      `INSERT INTO time_entries(id,task_id,minutes,logged_date,note,created_at,updated_at)
       VALUES(?,?,?,?, '演示数据', ?, ?)`,
    ).run(randomUUID(), id, minutes, status === 'completed' ? addDays(-1) : today, nowS, nowS);
  }
  console.log('task+', title);
  i += 1;
}

const open = db.prepare(`SELECT status, COUNT(*) c FROM tasks GROUP BY status`).all();
console.log('projects', db.prepare(`SELECT COUNT(*) c FROM projects`).get().c);
console.log('tasks', open);
console.log('db', dbPath);
