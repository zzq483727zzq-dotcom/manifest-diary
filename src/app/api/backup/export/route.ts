import { NextResponse } from 'next/server';
import { requireLocalSession, jsonError } from '@/lib/project/api';
import { exportBackup } from '@/lib/project/repository';

export async function GET() {
  const denied = await requireLocalSession();
  if (denied) return denied;
  try {
    return NextResponse.json({ backup: exportBackup() });
  } catch (error) {
    return jsonError(error, '导出失败', 500);
  }
}
