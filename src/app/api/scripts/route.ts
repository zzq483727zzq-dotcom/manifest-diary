import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeEntryDate, APP_TIMEZONE } from '@/lib/date';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const today = url.searchParams.get('date') || computeEntryDate(new Date(), APP_TIMEZONE);

  const { data, error } = await supabase
    .from('tomorrow_scripts')
    .select('*')
    .eq('user_id', user.id)
    .eq('scheduled_for', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ script: data });
}
