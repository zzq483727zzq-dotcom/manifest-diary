import { createClient } from '@/lib/supabase/server';

interface AILogInput {
  userId: string;
  mode: 'reflection' | 'manifest_echo' | 'manifest_analysis';
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
}

// Per-mode pricing (¥ per 1k tokens). Adjust when switching models.
const PRICING: Record<string, { in: number; out: number }> = {
  reflection: { in: 0.001, out: 0.002 },
  manifest_echo: { in: 0.001, out: 0.002 },
  manifest_analysis: { in: 0.001, out: 0.002 },
};

function estimateCost(mode: string, tokensIn: number, tokensOut: number): number {
  const p = PRICING[mode] ?? { in: 0.001, out: 0.002 };
  return (tokensIn / 1000) * p.in + (tokensOut / 1000) * p.out;
}

export async function logAiCall(input: AILogInput): Promise<void> {
  try {
    const supabase = await createClient();
    const cost = estimateCost(input.mode, input.tokensIn, input.tokensOut);
    await supabase.from('ai_call_logs').insert({
      user_id: input.userId,
      mode: input.mode,
      tokens_in: input.tokensIn,
      tokens_out: input.tokensOut,
      latency_ms: input.latencyMs,
      cost_estimate: cost,
    });
  } catch (e) {
    console.error('Failed to log AI call:', e);
  }
}
