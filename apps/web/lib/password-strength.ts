export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  weak: 'Weak',
  fair: 'Fair',
  good: 'Good',
  strong: 'Strong',
};

/**
 * A length-first heuristic, in keeping with NIST 800-63B: length and
 * character variety matter, arbitrary symbol requirements do not. Length
 * crosses three thresholds on its own; variety across the four character
 * classes (lower, upper, digit, symbol) can push it one tier further.
 */
export function scorePassword(password: string): {
  score: 0 | 1 | 2 | 3 | 4;
  strength: PasswordStrength;
  label: string;
} {
  let score = 0;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (password.length >= 20) score += 1;

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes >= 3) score += 1;

  const clamped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  const strength: PasswordStrength =
    clamped <= 1 ? 'weak' : clamped === 2 ? 'fair' : clamped === 3 ? 'good' : 'strong';
  return { score: clamped, strength, label: STRENGTH_LABEL[strength] };
}
