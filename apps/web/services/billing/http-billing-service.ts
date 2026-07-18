import { apiFetch } from '../http/transport';
import type { BillingService, CheckoutInput, CheckoutResult } from './types';

/** The real billing service — one POST to /v1/billing/checkout. */
export class HttpBillingService implements BillingService {
  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    return apiFetch<CheckoutResult>('/v1/billing/checkout', { method: 'POST', body: input });
  }
}
