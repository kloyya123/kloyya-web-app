import type { SubscriptionTier } from './preferences.js';

/**
 * What each beta plan is allowed to do.
 *
 * One definition, both ends: the frontend reads it to show "3 of 5 uploads used"
 * and to gate the upload button; the API reads it to enforce the same limits
 * server-side, because a client-only limit is a suggestion, not a rule.
 *
 * `null` means unlimited — Pro removes the ceiling rather than raising it to a
 * number we'd have to keep bumping. Free is deliberately generous enough to feel
 * the product and tight enough that heavy users have a reason to upgrade.
 */
export interface PlanEntitlements {
  /** Max uploaded documents the workspace may keep. `null` = unlimited. */
  maxDocuments: number | null;
  /** Max Ask Kloyya questions per day. `null` = unlimited. */
  askPerDay: number | null;
  /** Whether the "kept for later" providers (beyond the free set) are available. */
  allDataSources: boolean;
}

export const PLAN_ENTITLEMENTS: Record<SubscriptionTier, PlanEntitlements> = {
  free: {
    maxDocuments: 5,
    // The AI cap that applies to everyone while the paywall is hidden — enough for
    // real use, low enough to stop runaway searching. Raise/uncap once Pro is live.
    askPerDay: 30,
    allDataSources: true,
  },
  pro: {
    maxDocuments: null,
    askPerDay: null,
    allDataSources: true,
  },
};

export function entitlementsFor(tier: SubscriptionTier): PlanEntitlements {
  return PLAN_ENTITLEMENTS[tier];
}

/** Whether a count is still under a limit. Unlimited (`null`) always allows. */
export function withinLimit(used: number, limit: number | null): boolean {
  return limit === null || used < limit;
}

/** How many remain, or `null` for unlimited — for "N left" copy. */
export function remaining(used: number, limit: number | null): number | null {
  if (limit === null) return null;
  return Math.max(0, limit - used);
}
