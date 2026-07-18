import { cookies } from 'next/headers';
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { localDb, getSetting, setSetting } from '@/lib/local-db';

const COOKIE = 'manifest-local-session';
const SESSION_DAYS = 14;

export function hasLocalPassword() { return Boolean(getSetting('password_hash')); }
export function setLocalPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  setSetting('password_hash', `${salt}:${scryptSync(password, salt, 64).toString('hex')}`);
  if (!getSetting('session_secret')) setSetting('session_secret', randomBytes(32).toString('hex'));
}
export function verifyLocalPassword(password: string) {
  const stored = getSetting('password_hash'); if (!stored) return false;
  const [salt, expected] = stored.split(':'); const actual = scryptSync(password, salt, 64).toString('hex');
  return expected.length === actual.length && timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}
function tokenHash(token: string) { return createHmac('sha256', getSetting('session_secret') || 'local').update(token).digest('hex'); }
export function createLocalSession() {
  const token = randomBytes(32).toString('hex'); const now = new Date(); const expires = new Date(now.getTime() + SESSION_DAYS * 86400000);
  localDb.prepare('INSERT INTO sessions(token,created_at,expires_at) VALUES(?,?,?)').run(tokenHash(token), now.toISOString(), expires.toISOString()); return { token, expires };
}
export async function hasLocalSession() {
  const token = (await cookies()).get(COOKIE)?.value; if (!token) return false;
  const row = localDb.prepare('SELECT expires_at FROM sessions WHERE token = ?').get(tokenHash(token)) as { expires_at?: string } | undefined;
  return Boolean(row && new Date(row.expires_at!).getTime() > Date.now());
}
export const localSessionCookie = COOKIE;
