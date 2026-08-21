/**
 * Checks a password against Have I Been Pwned's Pwned Passwords list, using
 * k-anonymity: only the first 5 characters of the SHA-1 hash ever leave the
 * browser, so neither the password nor its full hash does. The endpoint is
 * built for exactly this client-side use and requires no API key.
 *
 * Resolves to the number of known breaches the password has appeared in (0
 * if none). Throws on a network/API failure — callers decide what that means;
 * a failed check must never be read as "not breached".
 */
export async function pwnedPasswordCount(password: string): Promise<number> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password));
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  if (!response.ok) {
    throw new Error(`Pwned Passwords check failed with status ${response.status}.`);
  }

  const body = await response.text();
  for (const line of body.split('\n')) {
    const [lineSuffix, count] = line.trim().split(':');
    if (lineSuffix === suffix) return Number(count ?? 0);
  }
  return 0;
}
