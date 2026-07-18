import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createLifeLog } from '@/lib/supabase/life';
import { parseLifeLogInput } from '@/lib/life/validation';
import { APP_TIMEZONE, computeEntryDate } from '@/lib/date';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  try {
    const input = parseLifeLogInput(await request.json());
    const log = await createLifeLog(user.id, computeEntryDate(new Date(), APP_TIMEZONE), input);
    return NextResponse.json({ log }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '保存失败' }, { status: 400 });
  }
}
