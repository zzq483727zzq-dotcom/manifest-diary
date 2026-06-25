import { createClient } from '@/lib/supabase/server';

export type MemoryType = 'theme' | 'emotion_pattern' | 'growth' | 'preference';

export interface UserMemory {
  id: string;
  user_id: string;
  created_at: string;
  memory_type: MemoryType;
  content: string;
  evidence: string;
  importance: number;
}

/**
 * 从 Supabase 读取当前用户最相关的记忆。
 * @param userId - 用户 ID
 * @param limit - 最多返回几条（默认 5）
 * @returns 按 importance 降序排列的记忆数组
 */
export async function loadUserMemory(userId: string, limit = 5): Promise<UserMemory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_memory')
    .select('id, memory_type, content, evidence, importance, created_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('importance', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as UserMemory[];
}

/**
 * 将记忆片段注入 system prompt。
 * 返回格式化的字符串，注入到 prompt 的 {{user_memory}} 变量处。
 */
export function formatMemoryForPrompt(memories: UserMemory[]): string {
  if (memories.length === 0) return '（暂无关于你的记忆。）';
  return (
    '【关于你】\n' +
    memories
      .map(
        (m) =>
          `- ${m.content}${m.evidence ? `（来源：${m.evidence.slice(0, 30)}）` : ''}`
      )
      .join('\n')
  );
}

/**
 * 写入一条新记忆。
 */
export async function saveUserMemory(params: {
  userId: string;
  memoryType: MemoryType;
  content: string;
  evidence: string;
  importance?: number;
}): Promise<void> {
  const supabase = await createClient();
  await supabase.from('user_memory').insert({
    user_id: params.userId,
    memory_type: params.memoryType,
    content: params.content,
    evidence: params.evidence,
    importance: params.importance ?? 3,
  });
}

/**
 * 检查同类旧记忆是否存在，必要时合并（提升 importance）。
 * 如果同类型、同内容的记忆已存在，提升其 importance +1。
 */
export async function upsertMemoryIfSimilar(params: {
  userId: string;
  memoryType: MemoryType;
  content: string;
  evidence: string;
  importance?: number;
}): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_memory')
    .select('id, importance')
    .eq('user_id', params.userId)
    .eq('memory_type', params.memoryType)
    .is('deleted_at', null)
    .ilike('content', `%${params.content.slice(0, 20)}%`)
    .limit(1);

  if (data && data.length > 0) {
    await supabase
      .from('user_memory')
      .update({ importance: Math.min(5, (data[0].importance ?? 3) + 1) })
      .eq('id', data[0].id);
  } else {
    await saveUserMemory(params);
  }
}
