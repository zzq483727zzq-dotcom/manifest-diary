import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface PatchBody {
  completed: boolean;
}

interface Step {
  step: number;
  action: string;
  duration_minutes: number;
  completed_at: string | null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stepIdx: string }> }
) {
  const { id, stepIdx } = await params;
  const idx = parseInt(stepIdx);
  if (isNaN(idx)) return NextResponse.json({ error: 'invalid step index' }, { status: 400 });

  const body = (await req.json()) as PatchBody;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // 读取当前 script
  const { data: script, error: readErr } = await supabase
    .from('tomorrow_scripts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (readErr || !script) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const steps = script.steps as Step[];
  if (idx < 0 || idx >= steps.length) {
    return NextResponse.json({ error: 'step out of range' }, { status: 400 });
  }

  steps[idx] = { ...steps[idx], completed_at: body.completed ? new Date().toISOString() : null };

  const allDone = steps.every((s) => s.completed_at !== null);

  const { error: updateErr } = await supabase
    .from('tomorrow_scripts')
    .update({
      steps,
      completed_at: allDone ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, allDone });
}
