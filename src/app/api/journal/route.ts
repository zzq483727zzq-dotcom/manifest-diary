import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeEntryDate, computeScheduledFor, APP_TIMEZONE } from '@/lib/date';
import type { ReflectionStructured } from '@/lib/ai/parse-response';

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
