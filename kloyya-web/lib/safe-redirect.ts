/**
 * Validate a post-authentication redirect target.
 *
 * `/login?next=<url>` is a textbook open-redirect vector: an attacker sends a
 * link to the genuine Kloyya login page, the user authenticates, and is then
 * bounced to a phishing clone that looks identical and asks them to "confirm"
 * their password. The domain in the address bar was real, right up until it wasn't.
 *
 * The rule is therefore an allowlist, not a denylist: accept only a path that is
 * unambiguously same-origin and relative.
 */

/** C0 controls and DEL. A newline can terminate a Location header early. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

/** Any leading scheme, e.g. `javascript:`, `data:`, `https:`. */
const HAS_SCHEME = /^\/*(?:[a-z][a-z0-9+.-]*:)/i;

export function safeRedirect(
  target: string | null | undefined,
  fallback: string,
): string {
  if (!target) return fallback;

  // Must begin with exactly one slash. `//evil.com` is protocol-relative and
  // resolves off-origin; `/\evil.com` is normalized to `//` by some browsers.
  if (!target.startsWith('/')) return fallback;
  if (target.startsWith('//')) return fallback;
  if (target.startsWith('/\\')) return fallback;

  let decoded: string;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    // A malformed escape sequence is not a path we are willing to guess at.
    return fallback;
  }

  // Re-check after decoding, so `/%2f%2fevil.com` and `%6a%61vascript:` fail too.
  if (decoded.startsWith('//')) return fallback;
  if (HAS_SCHEME.test(decoded)) return fallback;
  if (decoded.includes('\\')) return fallback;
  if (CONTROL_CHARS.test(decoded)) return fallback;

  return target;
}
