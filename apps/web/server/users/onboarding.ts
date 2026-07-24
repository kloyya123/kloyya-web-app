import { and, eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import type { Tx } from '@kloyya/db/scope';
import { memberships, organizations, userPreferences, users } from '@kloyya/db/schema';
import { can, type OnboardingProfile, type UserPreferences } from '@kloyya/core';

/**
 * Whether this caller may rename the organization they belong to.
 *
 * Asks the permission matrix rather than testing for `role === 'owner'`: an
 * administrator legitimately runs the company's Kloyya too, and hardcoding the
 * owner here would be a second, quietly diverging answer to a question
 * @kloyya/core already answers.
 */
async function mayUpdateOrganization(
  tx: Tx,
  authUserId: string,
  organizationId: string,
): Promise<boolean> {
  const [membership] = await tx
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(eq(memberships.userId, authUserId), eq(memberships.organizationId, organizationId)),
    )
    .limit(1);

  return membership ? can(membership.role, 'org:update') : false;
}

/**
 * The wire form of a {@link SettingsPatch}.
 *
 * `exactOptionalPropertyTypes` distinguishes "key absent" from "key present and
 * undefined". A parsed JSON body legitimately produces the latter (zod's
 * `.optional()` yields `T | undefined`), so the service accepts both and treats
 * them identically — an undefined field is a field you didn't patch. The
 * narrower `SettingsPatch` from @kloyya/core is assignable to this.
 */
export interface SettingsPatchInput {
  fullName?: string | undefined;
  jobTitle?: string | undefined;
  companyName?: string | undefined;
  industry?: string | undefined;
  preferences?:
    | {
        teamSize?: UserPreferences['teamSize'] | undefined;
        goals?: UserPreferences['goals'] | undefined;
        workStyle?: UserPreferences['workStyle'] | undefined;
        briefingTime?: UserPreferences['briefingTime'] | undefined;
        notificationLevel?: UserPreferences['notificationLevel'] | undefined;
        aiDraftingEnabled?: UserPreferences['aiDraftingEnabled'] | undefined;
      }
    | undefined;
}

/**
 * Persist the onboarding answers and flip `hasCompletedOnboarding`.
 *
 * The private-beta onboarding is short and personal, so the answers span three
 * tables in one transaction:
 *   user             → fullName (identity is Better Auth's)
 *   users            → hasCompletedOnboarding
 *   organizations    → subscriptionTier (the chosen plan)
 *   user_preferences → role, goals, priorities, proactiveness
 *
 * Onboarding asks these questions and explains why each personalizes Kloyya;
 * dropping the answers would make that explanation a lie. The org-shaped
 * questions (company, industry, team size) and the "how you work" preferences
 * are no longer asked — they keep their defaults and are editable in Settings.
 *
 * The plan is only written when the caller actually owns the organization —
 * billing is org-level, and letting an invited member's onboarding change the
 * whole org's plan would be a real bug once shared workspaces return. Non-owners
 * keep their personal answers; they just don't set someone else's plan.
 *
 * Returns false when the user has no profile to onboard.
 */
export async function completeOnboarding(
  db: AppDb,
  authUserId: string,
  profile: OnboardingProfile,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, authUserId))
      .limit(1);
    if (!row) return false;

    await tx
      .update(users)
      .set({ hasCompletedOnboarding: true, fullName: profile.fullName })
      .where(eq(users.id, authUserId));

    // The chosen plan does NOT grant a tier here — onboarding leaves everyone on
    // the org's default (free). Pro is granted only after the paywall's billing
    // checkout succeeds, so a user who picks Pro but never pays stays free rather
    // than getting Pro for nothing. `profile.plan` drives the client's routing to
    // the paywall, not the entitlement.

    await tx
      .update(userPreferences)
      .set({
        role: profile.role,
        goals: profile.goals,
        priorities: profile.priorities,
        proactiveness: profile.proactiveness,
      })
      .where(eq(userPreferences.userId, authUserId));

    return true;
  });
}

/**
 * Apply a Settings patch: only the fields present change, absent ones keep their
 * current value rather than being cleared.
 *
 * Same ownership rule as onboarding — the organization's name and industry are
 * only editable by someone who owns it. And the same transaction boundary, so a
 * half-applied patch can't survive a failure.
 *
 * Returns false when the user has no profile.
 */
export async function updateSettings(
  db: AppDb,
  authUserId: string,
  patch: SettingsPatchInput,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, authUserId))
      .limit(1);
    if (!row) return false;

    if (patch.fullName !== undefined) {
      await tx.update(users).set({ fullName: patch.fullName }).where(eq(users.id, authUserId));
    }

    if (patch.jobTitle !== undefined) {
      await tx.update(users).set({ jobTitle: patch.jobTitle }).where(eq(users.id, authUserId));
    }

    const orgChanges = {
      ...(patch.companyName !== undefined ? { name: patch.companyName } : {}),
      ...(patch.industry !== undefined ? { industry: patch.industry } : {}),
    };
    if (
      Object.keys(orgChanges).length > 0 &&
      (await mayUpdateOrganization(tx, authUserId, row.organizationId))
    ) {
      await tx.update(organizations).set(orgChanges).where(eq(organizations.id, row.organizationId));
    }

    const prefs = patch.preferences;
    if (prefs) {
      const prefChanges = {
        ...(prefs.teamSize !== undefined ? { teamSize: prefs.teamSize } : {}),
        ...(prefs.goals !== undefined ? { goals: prefs.goals } : {}),
        ...(prefs.workStyle !== undefined ? { workStyle: prefs.workStyle } : {}),
        ...(prefs.briefingTime !== undefined ? { briefingTime: prefs.briefingTime } : {}),
        ...(prefs.notificationLevel !== undefined
          ? { notificationLevel: prefs.notificationLevel }
          : {}),
        ...(prefs.aiDraftingEnabled !== undefined
          ? { aiDraftingEnabled: prefs.aiDraftingEnabled }
          : {}),
      };
      // Drizzle rejects an empty SET; `preferences: {}` is a no-op, not an error.
      if (Object.keys(prefChanges).length > 0) {
        await tx
          .update(userPreferences)
          .set(prefChanges)
          .where(eq(userPreferences.userId, authUserId));
      }
    }

    return true;
  });
}
