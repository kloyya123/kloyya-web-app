'use client';

import { ArrowRight, Check } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui';

/**
 * The request-access form.
 *
 * Kloyya is invitation-only, so the landing page's job is to take an address,
 * not to open an account. Sending someone to /signup would create a real
 * account they cannot use and hold them at a wall — this asks for the one thing
 * we actually need.
 *
 * The success state is deliberately identical whether the address was new or
 * already on the list. Saying "you're already signed up" would let anyone test
 * whether a particular person had registered interest.
 */
type State = 'idle' | 'sending' | 'joined' | 'error';

export function WaitlistForm({ source = 'landing' }: { source?: string }) {
  const inputId = useId();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === 'sending') return;

    setState('sending');
    setMessage('');

    try {
      const response = await fetch('/api/v1/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });

      if (response.ok) {
        setState('joined');
        return;
      }

      // The API's error envelope carries a sentence written for a person; use
      // it rather than inventing a generic failure message over the top of it.
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setState('error');
      setMessage(payload?.error?.message ?? 'That did not go through. Try again in a moment.');
    } catch {
      setState('error');
      setMessage('Could not reach Kloyya. Check your connection and try again.');
    }
  }

  if (state === 'joined') {
    return (
      <div
        className="border-positive/40 bg-success/10 flex items-start gap-3 rounded-md border p-4"
        role="status"
      >
        <Check aria-hidden="true" className="text-positive mt-0.5 size-5 shrink-0" />
        <div>
          <p className="text-foreground font-medium">You’re on the list.</p>
          <p className="text-small text-muted-foreground mt-0.5">
            We’ll email you when a place opens. Nothing else — no newsletter.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="max-w-xl">
      <label htmlFor={inputId} className="sr-only">
        Your email address
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={inputId}
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={state === 'error'}
          aria-describedby={state === 'error' ? `${inputId}-error` : undefined}
          className="border-border bg-surface text-foreground placeholder:text-subtle focus:border-link min-w-0 flex-1 rounded-sm border px-4 py-3 font-mono text-sm outline-none"
        />
        <Button
          type="submit"
          size="lg"
          isLoading={state === 'sending'}
          loadingLabel="Adding you"
          trailingIcon={<ArrowRight aria-hidden="true" />}
        >
          Request access
        </Button>
      </div>

      {state === 'error' ? (
        <p id={`${inputId}-error`} role="alert" className="text-small text-critical mt-2">
          {message}
        </p>
      ) : (
        <p className="text-caption text-subtle mt-2 font-mono">
          One email when your place opens. No newsletter, no sharing.
        </p>
      )}
    </form>
  );
}
