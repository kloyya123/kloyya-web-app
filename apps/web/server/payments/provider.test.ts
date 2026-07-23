import { describe, expect, it } from 'vitest';
import { entitlementsFor, remaining, withinLimit } from '@kloyya/core';
import { PaymentError, resolvePaymentProvider } from './provider';

/**
 * The payment scaffold and the entitlements it gates. Both are pure — no DB, no
 * network — so these assert the rules directly: Free has a real ceiling, Pro
 * lifts it, and a paid checkout without a payment method is refused the same way
 * a real processor would refuse it.
 */
describe('plan entitlements', () => {
  it('caps Free and lifts the cap for Pro', () => {
    expect(entitlementsFor('free').maxDocuments).toBe(5);
    // 30/day is the AI cap that applies while the paywall is hidden.
    expect(entitlementsFor('free').askPerDay).toBe(30);
    expect(entitlementsFor('pro').maxDocuments).toBeNull();
    expect(entitlementsFor('pro').askPerDay).toBeNull();
  });

  it('enforces a numeric limit and treats null as unlimited', () => {
    expect(withinLimit(4, 5)).toBe(true);
    expect(withinLimit(5, 5)).toBe(false);
    expect(withinLimit(9_999, null)).toBe(true);
  });

  it('reports how many remain, or null for unlimited', () => {
    expect(remaining(3, 5)).toBe(2);
    expect(remaining(6, 5)).toBe(0);
    expect(remaining(3, null)).toBeNull();
  });
});

describe('no-op payment provider', () => {
  const provider = resolvePaymentProvider({ provider: 'none' });

  it('activates Free with no payment method', async () => {
    const result = await provider.checkout({ tier: 'free' });
    expect(result).toMatchObject({ tier: 'free', status: 'active', providerRef: null });
  });

  it('refuses a paid tier without a payment method', async () => {
    await expect(provider.checkout({ tier: 'pro' })).rejects.toBeInstanceOf(PaymentError);
  });

  it('activates a paid tier once a tokenised method is supplied, charging nothing', async () => {
    const result = await provider.checkout({
      tier: 'pro',
      paymentMethod: { token: 'tok_opaque_from_client_sdk', saveForFuture: true },
    });
    expect(result).toMatchObject({ tier: 'pro', status: 'active' });
  });
});
