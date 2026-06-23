import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAiCall } from '@/lib/ai/log';
import { buildReflectionPrompt } from '@/lib/ai/prompts/reflection';

// Node runtime: required for TextDecoder('gbk') with stream mode.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Let Vercel keep this streaming function alive long enough for the
// reasoning model to finish thinking.
export const maxDuration = 60;

interface ReflectRequestBody {
  userInput: string;
  recentContext?: string;
}

// Accept both DEEPSEEK_* and ANTHROPIC_* env var names.
const UPSTREAM_URL =
  (process.env.DEEPSEEK_BASE_URL || process.env.ANTHROPIC_BASE_URL || 'https://www.dreamfield.top') +
  '/v1/chat/completions';
const UPSTREAM_MODEL = process.env.DEEPSEEK_MODEL || process.env.ANTHROPIC_MODEL || 'DeepSeek-V4-Flash';
const UPSTREAM_KEY = process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '';

/**
 * The dreamfield DeepSeek proxy returns Chinese text GBK-encoded even though
 * it claims utf-8. When streaming, a multi-byte GBK character can be split
 * across two chunks, so we MUST decode with a stateful decoder
 * (`stream: true`) that buffers incomplete byte sequences.
 *
 * GBK is a superset of ASCII, so JSON structural characters decode correctly
 * under GBK — meaning the decoded text is valid JSON we can parse directly.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
  const startTime = Date.now();
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

  let upstream: Response;
  try {
    upstream = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTREAM_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model: UPSTREAM_MODEL,
        stream: true,
        temperature: 0.7,
        max_tokens: 4000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: body.userInput },
        ],
      }),
    });
  } catch (error) {
    console.error('[reflect] upstream connect error:', error);
    return new Response(JSON.stringify({ error: 'AI 上游连接失败：' + String(error) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  if (!upstream.ok || !upstream.body) {
    const errText = new TextDecoder('utf-8', { fatal: false }).decode(await upstream.arrayBuffer());
    console.error('[reflect] upstream non-2xx:', upstream.status, errText.slice(0, 500));
    try {
      await logAiCall({
        userId: user.id,
        mode: 'reflection',
        tokensIn: 0,
        tokensOut: 0,
        latencyMs: Date.now() - startTime,
      });
    } catch (e) {
      console.error('[reflect] failed to log failed call:', e);
    }
    return new Response(JSON.stringify({ error: `上游 ${upstream.status}: ${errText.slice(0, 300)}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const encoder = new TextEncoder();
  // The dreamfield proxy historically returned GBK-encoded bodies for some
  // upstream models (e.g. older deepseek). Newer models (e.g. glm-5.2) return
  // proper UTF-8. We can't tell from headers (the proxy always advertises
  // utf-8), so we decode each raw chunk twice — once as utf-8, once as gbk —
  // and forward whichever decoding's `content` field looks like valid Chinese
  // text. Detection runs per-chunk and is locked once we see clear evidence.
  const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
  const gbkDecoder = new TextDecoder('gbk', { fatal: false });
  // null = unknown yet, 'utf-8' / 'gbk' once we've decided.
  let encodingChoice: 'utf-8' | 'gbk' | null = null;

  /** Lightweight heuristic: count U+FFFD replacement chars vs Chinese chars. */
  function looksLikeMojibake(text: string): boolean {
    const replacements = (text.match(/�/g) ?? []).length;
    if (replacements === 0) return false;
    const chinese = (text.match(/[一-鿿]/g) ?? []).length;
    return replacements > Math.max(1, chinese / 4);
  }

  /** Returns true if text contains the typical GBK-as-UTF-8 mojibake pattern. */
  function looksLikeGbkMisreadAsUtf8(text: string): boolean {
    // GBK Chinese bytes start with 0x80-0xFE. When utf-8-decoded, these often
    // map to characters in U+0080-U+00FF (Latin-1 supplement) or higher BMP
    // ranges that are rare in real Chinese text — e.g. 閱 (U+95B1), 鎶 (U+93B6).
    // Real Chinese is concentrated in U+4E00-U+9FFF. If we see lots of CJK
    // Unified Extension chars (U+3400+) with no chars in the common range,
    // it's almost certainly GBK misread.
    const rareCjk = (text.match(/[㐀-䶿龦-鿿-]/g) ?? []).length;
    const commonCjk = (text.match(/[一-龥]/g) ?? []).length;
    return rareCjk > 0 && rareCjk > commonCjk;
  }

  const upstreamReader = upstream.body.getReader();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Two parallel decode buffers — we'll commit to one after the first
      // few chunks reveal which is correct.
      let bufferUtf8 = '';
      let bufferGbk = '';
      let sawAnyContent = false;
      let tokensIn = 0;
      let tokensOut = 0;

      // Keep-alive ping during the model's reasoning phase so Vercel doesn't
      // 502 the request on long idle.
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          // controller already closed — ignore
        }
      }, 2000);

      try {
        while (true) {
          const { done, value } = await upstreamReader.read();
          if (done) break;

          // Decode the same bytes both ways with stream mode so split
          // multi-byte chars stay buffered until the next chunk completes them.
          bufferUtf8 += utf8Decoder.decode(value, { stream: true });
          bufferGbk += gbkDecoder.decode(value, { stream: true });

          // Lock the encoding choice once we have enough text to inspect.
          if (encodingChoice === null && (bufferUtf8.length > 80 || bufferGbk.length > 80)) {
            if (looksLikeMojibake(bufferUtf8) || looksLikeGbkMisreadAsUtf8(bufferUtf8)) {
              encodingChoice = 'gbk';
            } else {
              encodingChoice = 'utf-8';
            }
          }

          // While the encoding is still unknown, prefer utf-8 (the modern
          // expectation) and re-evaluate above.
          const active = encodingChoice === 'gbk' ? 'gbk' : 'utf-8';
          const bufferRef = { current: active === 'gbk' ? bufferGbk : bufferUtf8 };

          // SSE events are separated by a blank line (\n\n).
          const events = bufferRef.current.split('\n\n');
          const tail = events.pop() ?? '';
          // Keep the unconsumed tail in BOTH buffers — events we've handled get
          // dropped from both so we don't double-emit if we flip encoding.
          const consumedLen = bufferRef.current.length - tail.length;
          bufferUtf8 = bufferUtf8.slice(consumedLen);
          bufferGbk = bufferGbk.slice(consumedLen);

          for (const evt of events) {
            const line = evt.trim();
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') continue;

            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta;
              const content: string | undefined = delta?.content;
              if (content) {
                sawAnyContent = true;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                );
              }
              if (json.usage) {
                tokensIn = json.usage.prompt_tokens ?? tokensIn;
                tokensOut = json.usage.completion_tokens ?? tokensOut;
              }
            } catch {
              // partial JSON — ignore
            }
          }
        }

        // Flush trailing bytes.
        bufferUtf8 += utf8Decoder.decode();
        bufferGbk += gbkDecoder.decode();

        if (!sawAnyContent) {
          // Model thought the whole time and produced no answer content.
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error:
                  'AI 思考了很久但没有给出回答内容。请把话说得更具体一点，或稍后再试一次。',
              })}\n\n`
            )
          );
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        clearInterval(keepalive);
        try {
          await logAiCall({
            userId: user.id,
            mode: 'reflection',
            tokensIn,
            tokensOut,
            latencyMs: Date.now() - startTime,
          });
        } catch (e) {
          console.error('[reflect] failed to log successful call:', e);
        }
        controller.close();
      } catch (error) {
        console.error('[reflect] stream error:', error);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: String(error) })}\n\n`)
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        clearInterval(keepalive);
        try {
          await logAiCall({
            userId: user.id,
            mode: 'reflection',
            tokensIn,
            tokensOut,
            latencyMs: Date.now() - startTime,
          });
        } catch (e) {
          console.error('[reflect] failed to log errored call:', e);
        }
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
