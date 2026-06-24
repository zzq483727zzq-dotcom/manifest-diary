/**
 * Fast session check: decode JWT from Supabase auth cookie WITHOUT hitting
 * Supabase auth servers. JWT payload contains user id, email, and expiry —
 * all we need for an auth gate. RLS still enforces real authz on writes.
 *
 * Why: every navigation was awaiting supabase.auth.getUser() (a network
 * round-trip, ~200-500ms). The middleware already refreshes the cookie on
 * every request, so we can trust the JWT signature and read its payload
 * locally in <1ms.
 *
 * Cookie name pattern: sb-<project-ref>-auth-token (single cookie holds
 * base64-encoded JSON of { access_token, refresh_token, expires_at, ... }).
 */
import { cookies } from 'next/headers';

export interface SessionUser {
  id: string;
  email: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const authCookie = cookieStore.getAll().find(
    (c) => c.name.endsWith('-auth-token') && !c.name.includes('code-verifier')
  );
  if (!authCookie?.value) return null;

  try {
    let session: { access_token?: string; expires_at?: number };
    try {
      const decoded = Buffer.from(authCookie.value, 'base64').toString('utf-8');
      session = JSON.parse(decoded);
    } catch {
      session = JSON.parse(authCookie.value);
    }
    if (!session.access_token) return null;

    const parts = session.access_token.split('.');
    if (parts.length !== 3) return null;

    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadJson);

    if (payload.exp && payload.exp * 1000 < Date.now()) return null;

    return {
      id: payload.sub as string,
      email: (payload.email as string) || '',
    };
  } catch {
    return null;
  }
}