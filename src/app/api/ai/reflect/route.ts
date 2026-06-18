import { NextRequest } from 'next/server';
import { buildReflectionPrompt } from '@/lib/ai/prompts/reflection';

// Use Node runtime so we can use TextDecoder('gbk') and arbitrary fetch APIs.
// Edge runtime in Next.js does not support non-utf-8 TextDecoder.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ReflectRequestBody {
  userInput: string;
  recentContext?: string;
}

// Accept both DEEPSEEK_* and ANTHROPIC_* env var names
const UPSTREAM_URL = (process.env.DEEPSEEK_BASE_URL || process.env.ANTHROPIC_BASE_URL || 'https://www.dreamfield.top') + '/v1/chat/completions';
const UPSTREAM_MODEL = process.env.DEEPSEEK_MODEL || process.env.ANTHROPIC_MODEL || 'DeepSeek-V4-Flash';
const UPSTREAM_KEY = process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '';

/**
 * The dreamfield DeepSeek proxy lies about its response encoding: it sends
 * `Content-Type: application/json; charset=utf-8` but the body is actually
 * GBK-encoded for Chinese text. The OpenAI SDK trusts the header and
 * mangles the bytes, leaving us with corrupt strings that fail to parse.
 *
 * Fix: bypass the SDK. Fetch raw bytes, sniff the encoding, decode with the
 * correct one. Try utf-8 first; if the result looks like Mojibake (lots of
 * replacement chars), fall back to gbk.
 */
function decodeMaybeGbk(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  // Heuristic: count replacement characters and Chinese chars
  const replacementCount = (utf8.match(/�/g) ?? []).length;
  const chineseCount = (utf8.match(/[一-鿿]/g) ?? []).length;
  // If we have more replacement chars than Chinese chars, it's almost
  // certainly mis-decoded. Try gbk.
  if (replacementCount > 0 && replacementCount > chineseCount / 4) {
    try {
      const gbk = new TextDecoder('gbk', { fatal: false }).decode(bytes);
      return gbk;
    } catch {
      return utf8;
    }
  }
  // utf-8 looked clean (e.g. response was English / structured tokens only)
  return utf8;
}

export async function POST(request: NextRequest) {
  const body: ReflectRequestBody = await request.json();

  if (!body.userInput?.trim()) {
    return new Response(JSON.stringify({ error: 'userInput is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const systemPrompt = buildReflectionPrompt({
    currentTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    recentContext: body.recentContext,
  });

  // Non-streaming because DeepSeek-V4-Flash burns most tokens on
  // reasoning_content before producing actual content. We pull the whole
  // response, decode it correctly, then fake-stream to the client.
  let fullContent = '';
  let finishReason: string | null = null;

  try {
    const upstream = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${UPSTREAM_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model: UPSTREAM_MODEL,
        stream: false,
        temperature: 0.7,
        max_tokens: 4000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: body.userInput },
        ],
      }),
    });

    if (!upstream.ok) {
      const errText = decodeMaybeGbk(new Uint8Array(await upstream.arrayBuffer()));
      console.error('[reflect] upstream non-2xx:', upstream.status, errText.slice(0, 500));
      return new Response(
        JSON.stringify({ error: `上游 ${upstream.status}: ${errText.slice(0, 300)}` }),
        { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const buf = new Uint8Array(await upstream.arrayBuffer());
    const text = decodeMaybeGbk(buf);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error('[reflect] JSON.parse failed:', e, '| body preview:', text.slice(0, 500));
      return new Response(
        JSON.stringify({ error: '上游返回了无法解析的 JSON: ' + text.slice(0, 200) }),
        { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    type UpstreamChoice = {
      finish_reason?: string | null;
      message?: { content?: string };
    };
    type UpstreamResponse = { choices?: UpstreamChoice[]; usage?: unknown };
    const data = parsed as UpstreamResponse;
    const choice = data.choices?.[0];

    fullContent = choice?.message?.content ?? '';
    finishReason = choice?.finish_reason ?? null;

    console.log(
      '[reflect] non-stream done',
      '| finish=' + finishReason,
      '| content_len=' + fullContent.length,
      '| usage=' + JSON.stringify(data.usage)
    );
  } catch (error) {
    console.error('[reflect] upstream fetch error:', error);
    return new Response(
      JSON.stringify({ error: 'AI 上游调用失败：' + String(error) }),
      { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  if (!fullContent) {
    return new Response(
      JSON.stringify({
        error:
          'AI 没有返回 content（finish_reason=' +
          finishReason +
          '）。模型可能把所有 token 都用在了 reasoning 上，调大 max_tokens 或换非 reasoning 模型。',
      }),
      { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  // Fake-stream the content out as SSE so the existing client hook works
  // and the user gets a typewriter effect.
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const CHUNK_SIZE = 6;
      const DELAY_MS = 18;
      try {
        // Use Array.from to iterate by Unicode code points so we don't slice
        // through a multi-byte character.
        const chars = Array.from(fullContent);
        for (let i = 0; i < chars.length; i += CHUNK_SIZE) {
          const piece = chars.slice(i, i + CHUNK_SIZE).join('');
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: piece })}\n\n`)
          );
          if (DELAY_MS > 0) {
            await new Promise((r) => setTimeout(r, DELAY_MS));
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: String(error) })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
