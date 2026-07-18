import type { LifeLogType, LifeLogUnit } from '@/types/life';

export interface LifeLogInput {
  type: LifeLogType;
  value: number | null;
  unit: LifeLogUnit | null;
  content: string | null;
  start_at: string | null;
  end_at: string | null;
  metadata: Record<string, unknown>;
}

const types: LifeLogType[] = ['sleep', 'focus', 'mood', 'exercise', 'journal'];

export function parseLifeLogInput(raw: unknown): LifeLogInput {
  if (!raw || typeof raw !== 'object') throw new Error('请输入有效的记录');
  const input = raw as Record<string, unknown>;
  if (!types.includes(input.type as LifeLogType)) throw new Error('不支持的记录类型');
  const type = input.type as LifeLogType;
  const value = input.value == null || input.value === '' ? null : Number(input.value);
  if (value != null && (!Number.isFinite(value) || value < 0)) throw new Error('数值必须大于或等于 0');
  if (type === 'mood' && (value == null || value < 1 || value > 5)) throw new Error('能量评分应为 1 到 5');
  const content = typeof input.content === 'string' ? input.content.trim() : null;
  if (type === 'journal' && !content) throw new Error('请写下一点内容');
  const start_at = typeof input.start_at === 'string' && input.start_at ? input.start_at : null;
  const end_at = typeof input.end_at === 'string' && input.end_at ? input.end_at : null;
  if (start_at && end_at && Date.parse(end_at) < Date.parse(start_at)) throw new Error('结束时间不能早于开始时间');
  const unit: LifeLogUnit | null = type === 'mood' ? 'score' : value == null ? null : type === 'sleep' ? 'hours' : 'minutes';
  return { type, value, unit, content, start_at, end_at, metadata: typeof input.metadata === 'object' && input.metadata ? input.metadata as Record<string, unknown> : {} };
}
