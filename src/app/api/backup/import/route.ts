import { NextResponse } from 'next/server';
import { requireLocalSession, jsonError } from '@/lib/project/api';
import { importBackup, type BackupPayload } from '@/lib/project/repository';

export async function POST(request: Request) {
  const denied = await requireLocalSession();
  if (denied) return denied;
  try {
    const body = await request.json();
    const backup = (body?.backup ?? body) as BackupPayload;
    const counts = importBackup(backup);
    return NextResponse.json({ ok: true, counts });
  } catch (error) {
    return jsonError(error, '导入失败');
  }
}