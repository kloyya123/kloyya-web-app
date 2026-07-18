import type { SubscriptionTier } from '@/services/auth/types';

/**
 * Billing — the plan-checkout contract.
 *
 * The onboarding plan step calls this: Free activates immediately, a paid tier
 * carries a tokenised payment method. No raw card data crosses this boundary —
 * the token is all the server ever sees.
 */
export interface CheckoutPaymentMethod {
  /** Opaque token from the client-side processor SDK. Never a raw card number. */
  token: string;
  saveForFuture: boolean;
}

export interface CheckoutInput {
  tier: SubscriptionTier;
  paymentMethod?: CheckoutPaymentMethod;
}

export interface CheckoutResult {
  tier: SubscriptionTier;
  status: 'active' | 'pending';
}

export interface BillingService {
  /** Throws ApiError — `payment_required` (400) when a paid tier has no method. */
  checkout(input: CheckoutInput): Promise<CheckoutResult>;
}
