import { NextResponse } from 'next/server';
import { hasLocalSession } from '@/lib/local-auth';

export async function requireLocalSession() {
  if (!(await hasLocalSession())) {
    return NextResponse.json({ error: '请先解锁' }, { status: 401 });
  }
  return null;
}

export function jsonError(error: unknown, fallback = '操作失败', status = 400) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status },
  );
}
