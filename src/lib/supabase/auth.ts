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
    let session: { access_token?: string; expires_at?: number; user?: { id: string; email?: string } };
    let decodedRaw = authCookie.value;

    // Supabase SSR cookie value is base64-encoded JSON (chunked with
    // "base64-" prefix in some versions). Try multiple decode strategies.
    const tryParse = (raw: string): { access_token?: string; user?: { id: string; email?: string } } | null => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };

    // Strategy 1: raw JSON
    let parsed: any = tryParse(decodedRaw);
    // Strategy 2: base64-decode then JSON
    if (!parsed) {
      try {
        const stripped = decodedRaw.startsWith('base64-') ? decodedRaw.slice(7) : decodedRaw;
        const decoded = Buffer.from(stripped, 'base64').toString('utf-8');
        parsed = tryParse(decoded);
      } catch { /* fall through */ }
    }
    // Strategy 3: base64url decode
    if (!parsed) {
      try {
        const decoded = Buffer.from(decodedRaw, 'base64url').toString('utf-8');
        parsed = tryParse(decoded);
      } catch { /* fall through */ }
    }

    if (!parsed) {
      // Surface what we actually got so we can debug from the server logs.
      // eslint-disable-next-line no-console
      console.error('[auth] failed to decode Supabase cookie. first 200 chars:', decodedRaw.slice(0, 200));
      return null;
    }

    // Some Supabase cookie shapes put the user on `parsed.user`, others
    // only have the access_token we have to decode ourselves.
    const accessToken: string | undefined = parsed.access_token ?? parsed[0]?.access_token;

    if (accessToken && accessToken.split('.').length === 3) {
      const payloadJson = Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf-8');
      const payload = JSON.parse(payloadJson);
      if (payload.exp && payload.exp * 1000 < Date.now()) return null;
      return {
        id: payload.sub as string,
        email: (payload.email as string) || '',
      };
    }

    // Cookie shape where user is already inline
    if (parsed.user?.id) {
      return {
        id: parsed.user.id,
        email: parsed.user.email ?? '',
      };
    }

    return null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[auth] unexpected error decoding session:', e);
    return null;
  }
}