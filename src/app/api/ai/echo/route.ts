import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAiCall } from '@/lib/ai/log';
import { buildEchoPrompt } from '@/lib/ai/prompts/echo';

export const runtime = 'nodejs';

const UPSTREAM_URL = (process.env.DEEPSEEK_BASE_URL || process.env.ANTHROPIC_BASE_URL || 'https://www.dreamfield.top') + '/v1/chat/completions';
const UPSTREAM_MODEL = process.env.DEEPSEEK_MODEL || process.env.ANTHROPIC_MODEL || 'DeepSeek-V4-Flash';
const UPSTREAM_KEY = process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '';

function decodeMaybeGbk(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const replacementCount = (utf8.match(/�/g) ?? []).length;
  const chineseCount = (utf8.match(/[一-鿿]/g) ?? []).length;
  if (replacementCount > 0 && replacementCount > chineseCount / 4) {
    try { return new TextDecoder('gbk', { fatal: false }).decode(bytes); } catch { return utf8; }
  }
  return utf8;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponseError('Unauthorized', 401);

  const { entryId, intention } = await request.json();
  if (!entryId || !intention) return NextResponseError('entryId and intention are required', 400);

  const prompt = buildEchoPrompt(intention);
  const startTime = Date.now();

  try {
    const upstream = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${UPSTREAM_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ model: UPSTREAM_MODEL, stream: false, max_tokens: 150, temperature: 0.8, messages: [{ role: 'user', content: prompt }] }),
    });

    const buf = new Uint8Array(await upstream.arrayBuffer());
    const text = decodeMaybeGbk(buf);
    const parsed = JSON.parse(text);
    const echo = parsed.choices?.[0]?.message?.content?.trim() ?? '';

    const latencyMs = Date.now() - startTime;
    const tokensIn = parsed.usage?.prompt_tokens ?? 0;
    const tokensOut = parsed.usage?.completion_tokens ?? 0;

    await supabase.from('manifest_entries').update({ ai_echo: echo }).eq('id', entryId).eq('user_id', user.id);
    await logAiCall({ userId: user.id, mode: 'manifest_echo', tokensIn, tokensOut, latencyMs });

    return NextResponse.json({ echo });
  } catch (error) {
    console.error('[echo] upstream error:', error);
    return NextResponseError('AI 上游调用失败：' + String(error), 502);
  }
}

function NextResponseError(error: string, status: number) {
  return new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}