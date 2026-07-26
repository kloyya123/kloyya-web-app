/**
 * The private-beta allowlist.
 *
 * Kloyya is not open. Only the addresses named in BETA_ALLOWED_EMAILS may reach
 * the product; everyone else gets the landing page and a waitlist form, however
 * they arrived.
 *
 * WHY THIS IS ENFORCED IN MIDDLEWARE, not in the sign-up form.
 *
 * Sign-up and sign-in go from the browser straight to Supabase Auth — our server
 * is not in that path and cannot refuse the request. A check in the form would
 * therefore be advice, not a control: anyone can create an account by calling
 * Supabase directly with the public anon key, which ships in the bundle.
 *
 * So the account may exist. What it cannot do is reach the app: middleware runs
 * on every request, before any protected markup is sent, and sends a
 * non-allowlisted session to /beta instead. That is the boundary.
 *
 * WHY AN ENV VAR, not NEXT_PUBLIC_ and not a table.
 *
 * NEXT_PUBLIC_ would put the testers' personal addresses in the JavaScript
 * bundle for anyone to read. A table would be the right answer for a real
 * waitlist with an admin UI, but for two addresses during testing it is a
 * migration, a policy, and a query per request bought for nothing. When the
 * beta opens to more than a handful, replace this with a table — the call site
 * in middleware does not change.
 *
 * Comparison is case-insensitive and trims whitespace: addresses are
 * case-insensitive in practice, and a stray space in the env var should not
 * lock out a tester.
 */

/** Read the raw allowlist. Empty when unset. */
function rawAllowlist(): string {
  return process.env['BETA_ALLOWED_EMAILS'] ?? '';
}

/** Normalise one address for comparison. */
function normalise(email: string): string {
  return email.trim().toLowerCase();
}

export function betaAllowlist(): string[] {
  return rawAllowlist()
    .split(',')
    .map(normalise)
    .filter((entry) => entry.length > 0);
}

/**
 * Is this address allowed into the product?
 *
 * An EMPTY allowlist means the beta gate is off and everyone with an account is
 * allowed. That is deliberate: the alternative — empty means nobody — would
 * lock every user, including the owner, out of production the moment the
 * variable was missing or misspelled. A gate that fails closed on a config typo
 * is an outage, and this gate protects an unreleased beta, not user data. The
 * real protections (auth, RLS, tenant scoping) are unaffected either way.
 */
export function isBetaAllowed(email: string | null | undefined): boolean {
  const allowlist = betaAllowlist();
  if (allowlist.length === 0) return true;
  if (!email) return false;
  return allowlist.includes(normalise(email));
}
