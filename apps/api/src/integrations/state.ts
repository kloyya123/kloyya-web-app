import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * The OAuth `state` parameter.
 *
 * This is the only thing carrying "who started this, and for what" across a
 * round trip through Google. If the callback believed whatever came back, an
 * attacker could send a victim a link that grafts the ATTACKER's Google account
 * onto the VICTIM's workspace — Kloyya would then sync the attacker's calendar
 * into the victim's organization, or worse, hand the victim's users a connection
 * the attacker controls. So state is signed, bound to the user who started the
 * flow, and expires.
 *
 * Signed rather than stored: it needs no table, no cleanup job, and no read on
 * the callback path. The trade is that it cannot be single-use — the nonce and
 * the short TTL are what limit replay, and re-consenting is idempotent anyway
 * (the unique index on (workspace, integration) means a replay updates the same
 * row rather than creating a second).
 *
 * Format: base64url(payload).base64url(hmac) — the payload is readable, which is
 * fine: it holds no secret, only ids the holder already knows. Integrity is what
 * matters here, not confidentiality.
 */
const TTL_MS = 10 * 60 * 1000;

export interface OAuthState {
  /** Who began the flow. The callback must be the same person. */
  userId: string;
  workspaceId: string;
  organizationId: string;
  integrationId: string;
  /** Millis since epoch. */
  issuedAt: number;
  /** Makes two otherwise-identical states differ. */
  nonce: string;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function encodeState(
  state: Omit<OAuthState, 'issuedAt' | 'nonce'>,
  secret: string,
): string {
  const full: OAuthState = {
    ...state,
    issuedAt: Date.now(),
    nonce: randomBytes(9).toString('base64url'),
  };
  const payload = Buffer.from(JSON.stringify(full)).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export type StateResult =
  | { ok: true; state: OAuthState }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

export function decodeState(encoded: string, secret: string): StateResult {
  const parts = encoded.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [payload, signature] = parts as [string, string];

  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  // Constant-time: a forged state should not be discoverable byte by byte.
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, reason: 'bad_signature' };
  }

  let state: OAuthState;
  try {
    state = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthState;
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (
    typeof state.userId !== 'string' ||
    typeof state.workspaceId !== 'string' ||
    typeof state.organizationId !== 'string' ||
    typeof state.integrationId !== 'string' ||
    typeof state.issuedAt !== 'number'
  ) {
    return { ok: false, reason: 'malformed' };
  }

  // A signature proves we issued it, not that it's still relevant. An
  // authorization left open in a tab for a week should not still work.
  if (Date.now() - state.issuedAt > TTL_MS) return { ok: false, reason: 'expired' };

  return { ok: true, state };
}
