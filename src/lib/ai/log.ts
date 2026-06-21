import { createClient } from '@/lib/supabase/server';

interface AILogInput {
  userId: string;
  mode: 'reflection' | 'manifest_echo' | 'manifest_analysis';
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
}

export async function logAiCall(input: AILogInput): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from('ai_call_logs').insert({
      user_id: input.userId,
      mode: input.mode,
      tokens_in: input.tokensIn,
      tokens_out: input.tokensOut,
      latency_ms: input.latencyMs,
    });
  } catch (e) {
    console.error('Failed to log AI call:', e);
  }
}