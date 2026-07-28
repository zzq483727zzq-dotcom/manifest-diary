import { NextResponse } from 'next/server';
import { requireLocalSession, jsonError } from '@/lib/project/api';
import { setLocalPassword, verifyLocalPassword } from '@/lib/local-auth';

export async function POST(request: Request) {
  const denied = await requireLocalSession();
  if (denied) return denied;
  try {
    const body = await request.json();
    const oldPassword = typeof body?.oldPassword === 'string' ? body.oldPassword : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!oldPassword || !password) {
      return NextResponse.json({ error: '请填写当前密码和新密码' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '新密码至少 6 位' }, { status: 400 });
    }
    if (!verifyLocalPassword(oldPassword)) {
      return NextResponse.json({ error: '当前密码不正确' }, { status: 400 });
    }
    setLocalPassword(password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, '修改密码失败');
  }
}
