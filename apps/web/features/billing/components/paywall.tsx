'use client';

import { ArrowRight, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Card, CardContent, FormField, Input } from '@/components/ui';
import { FormError } from '@/features/auth/components/form-error';
import { PLAN_OPTIONS } from '@/lib/preference-options';
import { trackEvent } from '@/lib/analytics';
import { services } from '@/services';

/**
 * The Pro paywall.
 *
 * Reached only when a user picked Pro on the plan step; Free skips straight to
 * connecting tools. It collects a card and a "save for later" choice, then hands
 * off to the billing service and continues to tool connection.
 *
 * No payment processor is wired yet, on purpose. The card fields are captured
 * client-side and never sent — only an opaque placeholder token crosses to the
 * server, exactly where the real processor's token will slot in later. That is
 * the correct posture regardless: raw card numbers must never reach our backend.
 */
const PRO = PLAN_OPTIONS.find((plan) => plan.value === 'pro')!;

function price(): { now: string; was: string | null } {
  const discounted = PRO.discount ? PRO.priceUsd * (1 - PRO.discount) : PRO.priceUsd;
  return {
    now: `$${discounted.toFixed(0)}`,
    was: PRO.discount ? `$${PRO.priceUsd.toFixed(0)}` : null,
  };
}

const DIGITS = /\D/g;

export function Paywall() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [card, setCard] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [save, setSave] = useState(true);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cardDigits = card.replace(DIGITS, '');
  const expiryDigits = expiry.replace(DIGITS, '');
  const cvcDigits = cvc.replace(DIGITS, '');
  const canSubmit =
    name.trim().length > 1 &&
    cardDigits.length >= 15 &&
    expiryDigits.length === 4 &&
    cvcDigits.length >= 3;

  const { now, was } = price();

  async function submit() {
    if (!canSubmit || isSubmitting) return;
    setSubmitError(null);
    setIsSubmitting(true);
    trackEvent('paywall_submitted', { tier: 'pro', save });
    try {
      // The real processor tokenises card details in the browser and returns
      // this token. Until it's wired, a placeholder carries the last four so the
      // flow is exercised end to end without a card number ever leaving the page.
      const token = `tok_beta_${cardDigits.slice(-4)}`;
      await services.billing.checkout({ tier: 'pro', paymentMethod: { token, saveForFuture: save } });
      router.replace('/onboarding/connect-tools');
    } catch (error) {
      setSubmitError(error);
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">
      <div className="space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-heading-m text-foreground font-semibold">Start your Pro plan</h1>
          <p className="text-small text-muted-foreground">
            You can cancel anytime. Free stays free — this only applies to Pro.
          </p>
        </header>

        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-body text-foreground font-medium">Kloyya Pro</p>
              <p className="text-caption text-subtle">Billed monthly</p>
            </div>
            <div className="text-right">
              <p className="text-heading-s text-foreground font-semibold">
                {now}
                <span className="text-caption text-subtle font-normal"> /mo</span>
              </p>
              {was ? (
                <p className="text-caption text-subtle">
                  <span className="line-through">{was}</span>{' '}
                  <span className="text-primary">50% beta discount</span>
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <FormField label="Name on card" isRequired>
            {(field) => (
              <Input
                {...field}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="cc-name"
                placeholder="Alex Morgan"
              />
            )}
          </FormField>

          <FormField label="Card number" isRequired>
            {(field) => (
              <Input
                {...field}
                value={card}
                onChange={(event) => setCard(event.target.value)}
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="1234 5678 9012 3456"
                maxLength={19}
              />
            )}
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Expiry (MM/YY)" isRequired>
              {(field) => (
                <Input
                  {...field}
                  value={expiry}
                  onChange={(event) => setExpiry(event.target.value)}
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="08/28"
                  maxLength={5}
                />
              )}
            </FormField>
            <FormField label="CVC" isRequired>
              {(field) => (
                <Input
                  {...field}
                  value={cvc}
                  onChange={(event) => setCvc(event.target.value)}
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  placeholder="123"
                  maxLength={4}
                />
              )}
            </FormField>
          </div>

          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={save}
              onChange={(event) => setSave(event.target.checked)}
              className="border-border text-primary size-4 rounded"
            />
            <span className="text-small text-foreground">Save this payment method for next time</span>
          </label>

          <FormError error={submitError} />

          <Button
            type="submit"
            size="lg"
            className="w-full"
            isDisabled={!canSubmit}
            isLoading={isSubmitting}
            loadingLabel="Starting your plan"
            trailingIcon={<ArrowRight aria-hidden="true" />}
          >
            Start Pro — {now}/mo
          </Button>

          <p className="text-caption text-subtle flex items-center justify-center gap-1.5">
            <Lock aria-hidden="true" className="size-3" />
            Your card details never leave your browser during the beta.
          </p>

          <button
            type="button"
            onClick={() => router.replace('/onboarding/connect-tools')}
            className="text-caption text-muted-foreground hover:text-foreground mx-auto block rounded-sm"
          >
            Continue on Free for now
          </button>
        </form>
      </div>
    </main>
  );
}
