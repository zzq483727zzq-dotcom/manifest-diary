import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchLifeLogs } from '@/lib/supabase/life';
import { buildDashboardSummary } from '@/lib/life/aggregate';
import { buildLifeInsightInput, fallbackLifeInsight, parseLifeInsight } from '@/lib/ai/life-insight';
import { computeEntryDate, APP_TIMEZONE } from '@/lib/date';

const shift = (date: string, days: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

export async function POST(request: NextRequest) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const { windowDays = 7 } = await request.json().catch(() => ({})); const days = windowDays === 30 ? 30 : 7; const today = computeEntryDate(new Date(), APP_TIMEZONE);
  try {
    const logs = await fetchLifeLogs(user.id, shift(today, -(days - 1)), today); const summary = buildDashboardSummary(logs, today); const fallback = fallbackLifeInsight(summary);
    if (summary.coverageDays < 3 || !process.env.DEEPSEEK_API_KEY) return NextResponse.json({ insight: fallback, windowDays: days, generatedAt: new Date().toISOString() });
    const base = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com') + '/v1/chat/completions';
    const upstream = await fetch(base, { method: 'POST', headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', temperature: .2, max_tokens: 260, messages: [{ role: 'system', content: '你是个人生活记录助手。只做描述性总结，不做医疗或心理诊断，不声称确定因果。只返回 JSON：{"summary":"...","suggestions":["...","..."],"confidence":"low|medium|high"}。' }, { role: 'user', content: JSON.stringify(buildLifeInsightInput(summary, days)) }] }) });
    if (!upstream.ok) return NextResponse.json({ error: 'AI 暂时不可用', retryable: true }, { status: 503 });
    const json = await upstream.json(); const raw = json.choices?.[0]?.message?.content ?? ''; let parsed: unknown; try { parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '')); } catch { parsed = null; }
    return NextResponse.json({ insight: parseLifeInsight(parsed, fallback), windowDays: days, generatedAt: new Date().toISOString() });
  } catch { return NextResponse.json({ error: '洞察生成失败', retryable: true }, { status: 503 }); }
}
