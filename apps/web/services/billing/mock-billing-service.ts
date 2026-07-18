import { mockRespond } from '../http/mock-transport';
import type { BillingService, CheckoutInput, CheckoutResult } from './types';

/**
 * The mock billing service.
 *
 * No processor is wired yet, so this stands in: Free activates at once, a paid
 * tier "activates" the moment a (placeholder) token is present. It rides the
 * shared mock transport so the paywall's loading and error states are exercised
 * for real, and it mirrors the one rule the real backend will enforce — a paid
 * tier needs a payment method.
 */
export class MockBillingService implements BillingService {
  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    const result: CheckoutResult = {
      tier: input.tier,
      status: 'active',
    };
    return (await mockRespond(result)).data;
  }
}
