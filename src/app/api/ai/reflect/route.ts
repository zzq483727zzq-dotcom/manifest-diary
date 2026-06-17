import { NextRequest } from 'next/server';
import { createDeepSeekClient, DEEPSEEK_MODEL } from '@/lib/ai/client';
import { buildReflectionPrompt } from '@/lib/ai/prompts/reflection';

export const runtime = 'edge';

interface ReflectRequestBody {
  userInput: string;
  recentContext?: string;
}

export async function POST(request: NextRequest) {
  const body: ReflectRequestBody = await request.json();

  if (!body.userInput?.trim()) {
    return new Response(JSON.stringify({ error: 'userInput is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const systemPrompt = buildReflectionPrompt({
    currentTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    recentContext: body.recentContext,
  });

  const client = createDeepSeekClient();

  const stream = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: body.userInput },
    ],
    stream: true,
    temperature: 0.7,
    max_tokens: 2000,
  });

  // Convert OpenAI stream to SSE
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
            );
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
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
