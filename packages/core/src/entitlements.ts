import type { SubscriptionTier } from './preferences.js';

export interface PlanEntitlements {
  /** Max uploaded documents. null = unlimited. */
  maxDocuments: number | null;

  /** Max Ask Kloyya questions per day. null = unlimited. */
  askPerDay: number | null;

  /** Whether all supported data sources are available. */
  allDataSources: boolean;
}

export const PLAN_ENTITLEMENTS: Record<
  SubscriptionTier,
  PlanEntitlements
> = {
  free: {
    maxDocuments: 5,
    askPerDay: 30,
    allDataSources: true,
  },

  pro: {
    maxDocuments: null,
    askPerDay: null,
    allDataSources: true,
  },
};

export function entitlementsFor(
  tier: SubscriptionTier,
): PlanEntitlements {
  return PLAN_ENTITLEMENTS[tier];
}

/**
 * Check whether the current usage is still below
 * the configured limit.
 *
 * null means unlimited.
 */
export function withinLimit(
  used: number,
  limit: number | null,
): boolean {
  if (limit === null) {
    return true;
  }

  return used < limit;
}

/**
 * Return the remaining amount.
 *
 * null means unlimited.
 */
export function remaining(
  used: number,
  limit: number | null,
): number | null {
  if (limit === null) {
    return null;
  }

  return Math.max(
    0,
    limit - used,
  );
}
