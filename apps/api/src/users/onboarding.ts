import { and, eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import type { Tx } from '@kloyya/db/scope';
import { memberships, organizations, user, userPreferences, users } from '@kloyya/db/schema';
import { can, type OnboardingProfile, type SettingsPatch, type UserPreferences } from '@kloyya/core';

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
      }
    | undefined;
}

/**
 * Persist the onboarding answers and flip `hasCompletedOnboarding`.
 *
 * The answers span four tables, so this runs in one transaction:
 *   user             → fullName (identity is Better Auth's)
 *   users            → jobTitle, hasCompletedOnboarding
 *   organizations    → companyName, industry
 *   user_preferences → the five personalization answers
 *
 * Onboarding asks those five questions and explains why each one personalizes
 * Kloyya; dropping the answers would make that explanation a lie.
 *
 * The organization is only renamed when the caller actually owns it. The mock
 * renames unconditionally — safe when every user has their own org, but once a
 * user can be invited into an existing organization, letting their onboarding
 * rename the whole company would be a real bug. Non-owners keep their answers;
 * they just don't get to rename someone else's organization.
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

    await tx.update(user).set({ name: profile.fullName }).where(eq(user.id, authUserId));

    await tx
      .update(users)
      .set({ jobTitle: profile.jobTitle, hasCompletedOnboarding: true })
      .where(eq(users.id, authUserId));

    if (await mayUpdateOrganization(tx, authUserId, row.organizationId)) {
      await tx
        .update(organizations)
        .set({ name: profile.companyName, industry: profile.industry })
        .where(eq(organizations.id, row.organizationId));
    }

    await tx
      .update(userPreferences)
      .set({
        teamSize: profile.teamSize,
        goals: profile.goals,
        workStyle: profile.workStyle,
        briefingTime: profile.briefingTime,
        notificationLevel: profile.notificationLevel,
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
      await tx.update(user).set({ name: patch.fullName }).where(eq(user.id, authUserId));
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
