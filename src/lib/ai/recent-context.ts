import type { ReflectionStructured } from './parse-response';

export interface RecentEntry {
  entry_date: string;
  ai_structured: ReflectionStructured | null;
}

export function summarizeRecentEntries(entries: RecentEntry[]): string {
  if (entries.length === 0) return '';

  const lines = entries.map((e) => {
    if (!e.ai_structured) return `- ${e.entry_date}：（未处理）`;
    const facts = e.ai_structured.highlights.map((h) => h.fact).join('、') || '无明显高光';
    const bugs = e.ai_structured.cognitive_bugs.map((b) => b.type).join('、') || '无';
    return `- ${e.entry_date}：高光 [${facts}]；认知 bug [${bugs}]`;
  });

  return ['用户最近 3 天的记录摘要：', ...lines].join('\n');
}
