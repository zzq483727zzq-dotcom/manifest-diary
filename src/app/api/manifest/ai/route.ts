import { createClient } from '@/lib/supabase/server';
import { buildEchoPrompt } from '@/lib/ai/prompts/echo';
import { buildAnalyzePrompt } from '@/lib/ai/prompts/analyze';

export const runtime = 'nodejs';

const UPSTREAM_URL = (process.env.DEEPSEEK_BASE_URL || process.env.ANTHROPIC_BASE_URL || 'https://www.dreamfield.top') + '/v1/chat/completions';
const UPSTREAM_MODEL = process.env.DEEPSEEK_MODEL || process.env.ANTHROPIC_MODEL || 'DeepSeek-V4-Flash';
const UPSTREAM_KEY = process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '';

function decodeMaybeGbk(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  // Count replacement chars by checking for U+FFFD which indicates mis-encoding
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

/** Pre-parse: determine if the input is a short echo-style or long reflection-style, then route accordingly. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const { entryId, intention, isEcho } = await request.json();
  if (!entryId || !intention) return new Response(JSON.stringify({ error: 'entryId and intention required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  // Determine mode: "echo" for short manifest echo, "analyze" for keyword extraction
  const prompt = isEcho ? buildEchoPrompt(intention) : buildAnalyzePrompt(intention);
  const maxTokens = isEcho ? 150 : 200;
  const temperature = isEcho ? 0.8 : 0.3;

  try {
    const upstream = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${UPSTREAM_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ model: UPSTREAM_MODEL, stream: false, max_tokens: maxTokens, temperature, messages: [{ role: 'user', content: prompt }] }),
    });

    const buf = new Uint8Array(await upstream.arrayBuffer());
    const text = decodeMaybeGbk(buf);
    const parsed = JSON.parse(text);
    const raw = parsed.choices?.[0]?.message?.content?.trim() ?? '';

    const latencyMs = 0; // skip detailed timing for now
    const tokensIn = parsed.usage?.prompt_tokens ?? 0;
    const tokensOut = parsed.usage?.completion_tokens ?? 0;

    // Log call
    try {
      await supabase.from('ai_call_logs').insert({
        user_id: user.id,
        mode: isEcho ? 'manifest_echo' : 'manifest_analysis',
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        latency_ms: latencyMs,
      });
    } catch { /* non-critical */ }

    if (isEcho) {
      await supabase.from('manifest_entries').update({ ai_echo: raw }).eq('id', entryId).eq('user_id', user.id);
      return new Response(JSON.stringify({ echo: raw }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } else {
      let keywords: string[] = [];
      let insight = '';
      try { const p = JSON.parse(raw); keywords = p.keywords ?? []; insight = p.insight ?? ''; } catch { console.error('[manifest/ai] analyze parse failed:', raw); }
      if (keywords.length > 0 || insight) {
        const { data: current } = await supabase.from('manifest_entries').select('ai_echo').eq('id', entryId).single();
        const existing = current?.ai_echo ?? '';
        await supabase.from('manifest_entries').update({ keywords, ai_echo: existing ? `${existing}\n\n💡 ${insight}` : `💡 ${insight}` }).eq('id', entryId);
      }
      return new Response(JSON.stringify({ keywords, insight }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error('[manifest/ai] error:', error);
    return new Response(JSON.stringify({ error: 'AI 调用失败：' + String(error) }), { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
}