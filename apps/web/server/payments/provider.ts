import type { SubscriptionTier } from '@kloyya/core';

/**
 * The payment seam, one provider-neutral contract.
 *
 * Onboarding's plan step calls `checkout`; a provider turns that into a real
 * subscription. Today the only provider is the no-op scaffold — it records the
 * chosen tier and returns "active" without moving money — so the whole beta flow
 * (Free straight through, Pro via a paywall) works end to end before a real
 * processor is wired. Dropping in Stripe (or another) later means implementing
 * this one interface and flipping `PAYMENT_PROVIDER`, exactly like the AI seam.
 *
 * Security: raw card numbers never reach this server. The browser's provider SDK
 * tokenises the card and hands us an opaque `token`; we never see, log, or store
 * a PAN. The no-op provider ignores the token entirely.
 */
export interface PaymentMethodInput {
  /** Opaque token from the client-side provider SDK. Never a raw card number. */
  token: string;
  /** Whether to keep the method on file for renewals. */
  saveForFuture: boolean;
}

export interface CheckoutParams {
  tier: SubscriptionTier;
  /** Present only for a paid tier that went through the paywall. */
  paymentMethod?: PaymentMethodInput | undefined;
}

export interface CheckoutResult {
  tier: SubscriptionTier;
  /** `active` once the plan is in effect; `pending` if a real processor is awaiting confirmation. */
  status: 'active' | 'pending';
  /** The provider's subscription/reference id, or null for the no-op scaffold. */
  providerRef: string | null;
}

export interface PaymentProvider {
  /** 'none' for the scaffold; 'stripe' etc. once wired. */
  readonly name: string;
  checkout(params: CheckoutParams): Promise<CheckoutResult>;
}

/** A misuse of the payment flow — e.g. a paid tier with no payment method. */
export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

/**
 * The beta scaffold. It takes no money — it only records the intended tier.
 *
 * Free is always active immediately. A paid tier requires a (tokenised) payment
 * method, so the paywall is a real gate rather than a formality; without one it
 * refuses, which is the same shape a real processor would enforce. Nothing is
 * charged and nothing card-shaped is stored.
 */
class NoopPaymentProvider implements PaymentProvider {
  readonly name = 'none';

  async checkout(params: CheckoutParams): Promise<CheckoutResult> {
    if (params.tier !== 'free' && !params.paymentMethod) {
      throw new PaymentError('A paid plan needs a payment method.');
    }
    return { tier: params.tier, status: 'active', providerRef: null };
  }
}

export interface PaymentConfig {
  provider: 'none';
}

/**
 * The configured payment provider. Only the no-op scaffold exists today; when a
 * real processor lands, this returns it based on `PAYMENT_PROVIDER`.
 */
export function resolvePaymentProvider(_config: PaymentConfig): PaymentProvider {
  return new NoopPaymentProvider();
}
