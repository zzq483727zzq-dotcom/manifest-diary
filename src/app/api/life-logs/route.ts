import { NextRequest, NextResponse } from 'next/server';
import { hasLocalSession } from '@/lib/local-auth';
import { createLifeLog } from '@/lib/supabase/life';
import { parseLifeLogInput } from '@/lib/life/validation';
import { APP_TIMEZONE, computeEntryDate } from '@/lib/date';

export async function POST(request: NextRequest) {
  if (!await hasLocalSession()) return NextResponse.json({ error: '请先解锁' }, { status: 401 });
  try {
    const input = parseLifeLogInput(await request.json());
    const log = await createLifeLog('local', computeEntryDate(new Date(), APP_TIMEZONE), input);
    return NextResponse.json({ log }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '保存失败' }, { status: 400 });
  }
}
