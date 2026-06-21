import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAiCall } from '@/lib/ai/log';
import { buildAnalyzePrompt } from '@/lib/ai/prompts/analyze';

export const runtime = 'nodejs';

const UPSTREAM_URL = (process.env.DEEPSEEK_BASE_URL || process.env.ANTHROPIC_BASE_URL || 'https://www.dreamfield.top') + '/v1/chat/completions';
const UPSTREAM_MODEL = process.env.DEEPSEEK_MODEL || process.env.ANTHROPIC_MODEL || 'DeepSeek-V4-Flash';
const UPSTREAM_KEY = process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '';

function decodeMaybeGbk(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  // Count U+FFFD replacement chars that indicate mis-encoding
  let replacementCount = 0;
  for (let i = 0; i < utf8.length; i++) {
    if (utf8.charCodeAt(i) === 0xFFFD || utf8.charCodeAt(i) === 0x1A) replacementCount++;
  }
  const chineseCount = (utf8.match(/[一-鿿]/g) ?? []).length;
  if (replacementCount > 0 && replacementCount > chineseCount / 4) {
    try { return new TextDecoder('gbk', { fatal: false }).decode(bytes); } catch { return utf8; }
  }
  return utf8;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const { entryId, intention } = await request.json();
  if (!entryId || !intention) return new Response(JSON.stringify({ error: 'entryId and intention are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const prompt = buildAnalyzePrompt(intention);
  const startTime = Date.now();

  try {
    const upstream = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${UPSTREAM_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ model: UPSTREAM_MODEL, stream: false, max_tokens: 200, temperature: 0.3, messages: [{ role: 'user', content: prompt }] }),
    });

    const buf = new Uint8Array(await upstream.arrayBuffer());
    const text = decodeMaybeGbk(buf);
    const parsed = JSON.parse(text);
    const raw = parsed.choices?.[0]?.message?.content?.trim() ?? '';

    const latencyMs = Date.now() - startTime;
    const tokensIn = parsed.usage?.prompt_tokens ?? 0;
    const tokensOut = parsed.usage?.completion_tokens ?? 0;

    let keywords: string[] = [];
    let insight = '';
    try { const p = JSON.parse(raw); keywords = p.keywords ?? []; insight = p.insight ?? ''; } catch { console.error('[analyze] parse failed:', raw); }

    if (keywords.length > 0 || insight) {
      const { data: current } = await supabase.from('manifest_entries').select('ai_echo').eq('id', entryId).single();
      const existingEcho = current?.ai_echo ?? '';
      await supabase.from('manifest_entries').update({ keywords, ai_echo: existingEcho ? `${existingEcho}\n\n💡 ${insight}` : `💡 ${insight}` }).eq('id', entryId);
    }

    await logAiCall({ userId: user.id, mode: 'manifest_analysis', tokensIn, tokensOut, latencyMs });

    return NextResponse.json({ keywords, insight });
  } catch (error) {
    console.error('[analyze] upstream error:', error);
    return new Response(JSON.stringify({ error: 'AI 上游调用失败：' + String(error) }), { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
}