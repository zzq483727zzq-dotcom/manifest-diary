import { NextResponse } from 'next/server';
import { createLocalSession, hasLocalPassword, localSessionCookie, setLocalPassword } from '@/lib/local-auth';

export async function POST(request: Request) {
  if (hasLocalPassword()) return NextResponse.json({ error: '密码已经设置' }, { status: 409 });
  const { password } = await request.json();
  if (typeof password !== 'string' || password.length < 6) return NextResponse.json({ error: '密码至少需要 6 位' }, { status: 400 });
  setLocalPassword(password); const session = createLocalSession(); const response = NextResponse.json({ ok: true });
  response.cookies.set(localSessionCookie, session.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires: session.expires, path: '/' }); return response;
}
