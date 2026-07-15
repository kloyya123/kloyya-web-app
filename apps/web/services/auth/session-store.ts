import type { Session } from './types';

/**
 * Where the mock session lives.
 *
 * In production, KESM requires an httpOnly, Secure, SameSite cookie holding an
 * opaque session reference, written by the server and unreadable to JavaScript.
 * A mock backend has no server to write it, so this uses a document cookie.
 *
 * That is a *deliberate, contained* deviation, and it is contained here:
 *   - No component reads the cookie. They call AuthService.
 *   - The cookie holds no secret, only a session id and a display payload.
 *   - Swapping to the real scheme replaces this file, and nothing else.
 *
 * The cookie (rather than localStorage) is what lets Next middleware read the
 * session during a server-side redirect, which is how route protection works
 * without a flash of the login page.
 */

const COOKIE_NAME = 'kloyya_mock_session';
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8h, matching a short-lived access token.

function isBrowser(): boolean {
  return typeof document !== 'undefined';
}

/**
 * Parse a raw cookie value into a live Session, or null.
 *
 * Environment-agnostic on purpose: the browser passes `document.cookie`'s value,
 * and a Server Component passes the value from `next/headers`. Seeding the
 * session on the server is what lets authenticated pages render their content
 * during SSR instead of shipping a skeleton and filling it in after hydration.
 *
 * In production this is exactly the shape of reading a real session cookie
 * server-side, so the seam does not move when the backend arrives.
 */
export function parseSessionCookie(rawValue: string | undefined): Session | null {
  if (!rawValue) return null;

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(rawValue));
    if (!isWellFormedSession(parsed)) return null;
    // An expired token is no token — on the server or the client.
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * A session is only usable if it carries the whole shape the app renders from.
 *
 * Without this, a tampered or truncated cookie — one with `user` but no
 * `organization`, say — would satisfy the middleware's coarse check, then crash
 * every authenticated page the moment the top bar reads `organization.name`.
 * A malformed session must read as *no* session, so the user lands on login,
 * not on a 500.
 */
function isWellFormedSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  const session = value as Record<string, unknown>;
  return (
    isRecord(session.user) &&
    isRecord(session.organization) &&
    isRecord(session.workspace) &&
    // Settings renders straight from these; a session without them would 500 the
    // page rather than fail closed. A cookie predating this field reads as no
    // session, which lands the user on login — the correct outcome.
    isRecord(session.preferences) &&
    typeof session.expiresAt === 'string' &&
    typeof session.accessToken === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function readSession(): Session | null {
  if (!isBrowser()) return null;

  const raw = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);

  const session = parseSessionCookie(raw);
  // A missing-but-present cookie (expired, corrupt) is cleared so the browser
  // stops sending it. The server-side parser cannot write, so it only reads.
  if (!session && raw) clearSession();
  return session;
}

export function writeSession(session: Session): void {
  if (!isBrowser()) return;
  const value = encodeURIComponent(JSON.stringify(session));
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=${value}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function clearSession(): void {
  if (!isBrowser()) return;
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/** Name exported so middleware can look for the cookie without importing browser code. */
export const SESSION_COOKIE_NAME = COOKIE_NAME;
