'use client';

import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { scorePassword, type PasswordStrength } from '@/lib/password-strength';
import { pwnedPasswordCount } from '@/lib/pwned-password';

const BAR_TONE: Record<PasswordStrength, string> = {
  weak: 'bg-danger',
  fair: 'bg-warning',
  good: 'bg-info',
  strong: 'bg-success',
};

const LABEL_TONE: Record<PasswordStrength, string> = {
  weak: 'text-critical',
  fair: 'text-caution',
  good: 'text-notice',
  strong: 'text-positive',
};

/**
 * Live feedback under the password field: a length/variety strength meter,
 * plus a breach check against Have I Been Pwned (see lib/pwned-password.ts —
 * only a 5-character hash prefix ever leaves the browser).
 *
 * Advisory only — this never blocks typing or submission on its own. The hard
 * gate against a confirmed-breached password lives in the form's submit
 * handler, which re-checks at submit time; a slow network here must never
 * silently prevent someone from finishing the field.
 */
export function PasswordStrengthMeter({ password }: { password: string }) {
  const [breachCount, setBreachCount] = useState<number | null>(null);

  useEffect(() => {
    setBreachCount(null);
    if (password.length < 8) return;
    const timer = setTimeout(() => {
      pwnedPasswordCount(password)
        .then(setBreachCount)
        .catch(() => {
          // Network/API failure: say nothing rather than a false "not breached".
        });
    }, 500);
    return () => clearTimeout(timer);
  }, [password]);

  if (!password) return null;

  const { score, strength, label } = scorePassword(password);

  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex gap-1" role="img" aria-label={`Password strength: ${label}`}>
        {[0, 1, 2, 3].map((segment) => (
          <span
            key={segment}
            aria-hidden="true"
            className={cn('h-1 flex-1 rounded-full transition-colors', segment < score ? BAR_TONE[strength] : 'bg-hover')}
          />
        ))}
      </div>
      <p className={cn('text-caption', LABEL_TONE[strength])}>{label}</p>
      {breachCount ? (
        <p className="text-caption text-critical flex items-center gap-1.5" role="alert">
          <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
          Found in {breachCount.toLocaleString()} known data breaches — choose a different password.
        </p>
      ) : null}
    </div>
  );
}
