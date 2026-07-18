import { NextResponse } from 'next/server';
import { createLocalSession, localSessionCookie, verifyLocalPassword } from '@/lib/local-auth';

export async function POST(request: Request) {
  const { password } = await request.json();
  if (typeof password !== 'string' || !verifyLocalPassword(password)) return NextResponse.json({ error: '密码不正确' }, { status: 401 });
  const session = createLocalSession(); const response = NextResponse.json({ ok: true });
  response.cookies.set(localSessionCookie, session.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires: session.expires, path: '/' }); return response;
}
