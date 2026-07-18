import { randomUUID } from 'node:crypto';
import { localDb } from '@/lib/local-db';
import type { LifeLog } from '@/types/life';
import type { LifeLogInput } from '@/lib/life/validation';

function mapRow(row: Record<string, unknown>): LifeLog {
  return { ...row, metadata: JSON.parse(String(row.metadata || '{}')) } as LifeLog;
}

export async function fetchLifeLogs(_userId: string, startDate: string, endDate: string): Promise<LifeLog[]> {
  const rows = localDb.prepare('SELECT * FROM life_logs WHERE entry_date >= ? AND entry_date <= ? ORDER BY created_at').all(startDate, endDate) as Record<string, unknown>[];
  return rows.map(mapRow);
}

export async function createLifeLog(_userId: string, entryDate: string, input: LifeLogInput): Promise<LifeLog> {
  const id = randomUUID(); const createdAt = new Date().toISOString();
  localDb.prepare('INSERT INTO life_logs(id,entry_date,type,start_at,end_at,value,unit,content,metadata,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id, entryDate, input.type, input.start_at, input.end_at, input.value, input.unit, input.content, JSON.stringify(input.metadata), createdAt);
  return mapRow({ id, entry_date: entryDate, type: input.type, start_at: input.start_at, end_at: input.end_at, value: input.value, unit: input.unit, content: input.content, metadata: JSON.stringify(input.metadata), created_at: createdAt });
}
