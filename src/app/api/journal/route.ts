import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeEntryDate, computeScheduledFor, APP_TIMEZONE } from '@/lib/date';
import type { ReflectionStructured } from '@/lib/ai/parse-response';
import { upsertMemoryIfSimilar } from '@/lib/ai/memory';

interface CreateBody {
  rawInput: string;
  inputMethod: 'voice' | 'text' | 'mixed';
  aiResponse: string;
  aiStructured: ReflectionStructured;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json()) as CreateBody;
  if (!body.rawInput?.trim() || !body.aiStructured) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  const entryDate = computeEntryDate(new Date(), APP_TIMEZONE);

  const { data: journal, error: journalErr } = await supabase
    .from('journal_entries')
    .insert({
      user_id: user.id,
      entry_date: entryDate,
      raw_input: body.rawInput,
      input_method: body.inputMethod,
      ai_response: body.aiResponse,
      ai_structured: body.aiStructured,
      status: 'finalized',
    })
    .select()
    .single();

  if (journalErr || !journal) {
    return NextResponse.json({ error: journalErr?.message || 'insert failed' }, { status: 500 });
  }

  // 记忆写入：从复盘中提炼用户画像
  if (body.aiStructured) {
    try {
      const struct = body.aiStructured;
      // 从 highlights 提炼主题记忆
      if (struct.highlights && struct.highlights.length > 0) {
        const top = struct.highlights[0];
        await upsertMemoryIfSimilar({
          userId: user.id,
          memoryType: 'growth',
          content: `用户近期高光：${top.fact}`,
          evidence: top.why_it_counts,
          importance: 2,
        });
      }
      // 从 cognitive_bugs 提炼情绪模式记忆
      if (struct.cognitive_bugs && struct.cognitive_bugs.length > 0) {
        const bug = struct.cognitive_bugs[0];
        await upsertMemoryIfSimilar({
          userId: user.id,
          memoryType: 'emotion_pattern',
          content: `用户容易出现认知盲点：${bug.user_quote.slice(0, 30)}`,
          evidence: bug.reframe,
          importance: 2,
        });
      }
    } catch (e) {
      console.error('[journal] memory write failed:', e);
    }
  }

  const scheduledFor = computeScheduledFor(entryDate);
  const stepsWithCompleted = body.aiStructured.tomorrow_script.map((s) => ({
    ...s,
    completed_at: null,
  }));

  const { error: scriptErr } = await supabase.from('tomorrow_scripts').insert({
    user_id: user.id,
    source_entry_id: journal.id,
    scheduled_for: scheduledFor,
    steps: stepsWithCompleted,
  });

  if (scriptErr) {
    return NextResponse.json(
      { id: journal.id, warning: `script create failed: ${scriptErr.message}` },
      { status: 201 }
    );
  }

  return NextResponse.json({ id: journal.id, scheduledFor }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const date = url.searchParams.get('date');

  let query = supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('entry_date', { ascending: false });

  if (date) query = query.eq('entry_date', date);
  else query = query.limit(30);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data });
}
