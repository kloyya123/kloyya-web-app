/**
 * The private-beta allowlist.
 *
 * Only the addresses in BETA_ALLOWED_EMAILS may use the product. Everyone else
 * gets the landing page and the waiting list.
 *
 * WHY THIS IS ENFORCED IN MIDDLEWARE, not in the sign-up form.
 *
 * Sign-up and sign-in go from the browser straight to Supabase Auth — our server
 * is not in that path and cannot refuse the request. A check in the form would
 * be advice, not a control: anyone can create an account by calling Supabase
 * directly with the public anon key, which ships in the bundle.
 *
 * So the account may exist. What it cannot do is reach the app: middleware runs
 * on every request, before any protected markup is sent.
 *
 * A NOTE ON THE PREVIOUS ATTEMPT. An earlier version of this gate refused an
 * address that WAS on the list, and the cause was never established because
 * nothing about the check was observable from outside — the same blank wall
 * appeared whether the variable was missing, malformed, or the session carried
 * no email. `describeAllowlist` exists so that can be told apart at a glance
 * without exposing anyone's address.
 */

/** Normalise one address for comparison. Addresses are case-insensitive. */
function normalise(email: string): string {
  return email.trim().toLowerCase();
}

export function betaAllowlist(): string[] {
  return (process.env['BETA_ALLOWED_EMAILS'] ?? '')
    .split(',')
    .map(normalise)
    .filter((entry) => entry.length > 0);
}

/**
 * Is this address allowed into the product?
 *
 * An EMPTY allowlist means the gate is OFF and everyone with an account is
 * allowed. That is deliberate: the alternative — empty means nobody — would
 * lock every user out of production the moment the variable was missing or
 * misspelled. This gates a product stage, not user data; auth, RLS and tenant
 * scoping are unaffected either way.
 */
export function isBetaAllowed(email: string | null | undefined): boolean {
  const allowlist = betaAllowlist();
  if (allowlist.length === 0) return true;
  if (!email) return false;
  return allowlist.includes(normalise(email));
}

/**
 * A one-line, non-identifying description of what the gate can see.
 *
 * Emitted as a response header by middleware so the runtime's actual view can be
 * checked with a single request. It reveals a count and the shape of the entries
 * — enough to distinguish "the variable never arrived" from "it arrived with a
 * stray quote" — but never an address.
 */
export function describeAllowlist(): string {
  const list = betaAllowlist();
  if (list.length === 0) return 'off:0';
  // Lengths only. A wrong length is the tell for a stray quote or space.
  return `on:${list.length}:${list.map((entry) => entry.length).join(',')}`;
}
