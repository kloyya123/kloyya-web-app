import { and, eq, isNull } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import {
  memberships,
  organizations,
  user,
  userPreferences,
  users,
  workspaces,
} from '@kloyya/db/schema';
import type { Organization, User, UserPreferences, Workspace } from '@kloyya/core';

/**
 * Compose the domain `User` — the shape the frontend already types in
 * @kloyya/core — out of the tables that each own a piece of it:
 *
 *   user         → identity (email, name, image, verification)  [Better Auth]
 *   users        → profile  (org, job title, timezone, onboarding)
 *   memberships  → the role the user holds *in their active workspace*
 *
 * The frontend's flat `user.role` is exactly that: the role from the active
 * workspace's membership. Keeping the join here means the wire shape stays
 * identical to the mock's, so swapping the transport changes no components.
 *
 * Returns null when no profile exists for the identity — a user that got created
 * but never provisioned. Callers treat that as "not a complete account" rather
 * than inventing defaults.
 */
export async function composeUser(db: AppDb, authUserId: string): Promise<User | null> {
  const rows = await db
    .select({
      id: user.id,
      email: user.email,
      fullName: user.name,
      image: user.image,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      organizationId: users.organizationId,
      jobTitle: users.jobTitle,
      timezone: users.timezone,
      hasCompletedOnboarding: users.hasCompletedOnboarding,
      role: memberships.role,
    })
    .from(user)
    .innerJoin(users, eq(users.id, user.id))
    // The membership for the workspace the user currently has open. Left-joined:
    // a profile without an active workspace still yields a User.
    .leftJoin(
      memberships,
      and(eq(memberships.userId, users.id), eq(memberships.workspaceId, users.activeWorkspaceId)),
    )
    .where(and(eq(user.id, authUserId), isNull(users.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    organizationId: row.organizationId,
    email: row.email,
    fullName: row.fullName,
    // exactOptionalPropertyTypes: an absent avatar is an absent key, not undefined.
    ...(row.image ? { avatarUrl: row.image } : {}),
    jobTitle: row.jobTitle,
    role: row.role ?? 'employee',
    timezone: row.timezone,
    isEmailVerified: row.emailVerified,
    hasCompletedOnboarding: row.hasCompletedOnboarding,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Everything a signed-in client needs to render: who you are, where you work,
 * and how you want Kloyya to behave.
 *
 * This mirrors the frontend's `Session` minus `accessToken`/`expiresAt` — those
 * are the mock's model of a token the real system keeps in an httpOnly cookie
 * the client cannot read. Putting it in the response body would hand the browser
 * exactly the thing that boundary exists to withhold.
 */
export interface AccountSession {
  user: User;
  organization: Organization;
  workspace: Workspace;
  preferences: UserPreferences;
}

export async function composeSession(
  db: AppDb,
  authUserId: string,
): Promise<AccountSession | null> {
  const composed = await composeUser(db, authUserId);
  if (!composed) return null;

  const rows = await db
    .select({
      orgId: organizations.id,
      orgName: organizations.name,
      orgIndustry: organizations.industry,
      orgLogoUrl: organizations.logoUrl,
      orgPlan: organizations.plan,
      wsId: workspaces.id,
      wsName: workspaces.name,
      wsTrustScore: workspaces.trustScore,
      teamSize: userPreferences.teamSize,
      goals: userPreferences.goals,
      workStyle: userPreferences.workStyle,
      briefingTime: userPreferences.briefingTime,
      notificationLevel: userPreferences.notificationLevel,
    })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.organizationId))
    .innerJoin(workspaces, eq(workspaces.id, users.activeWorkspaceId))
    .innerJoin(userPreferences, eq(userPreferences.userId, users.id))
    .where(eq(users.id, authUserId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    user: composed,
    organization: {
      id: row.orgId,
      name: row.orgName,
      industry: row.orgIndustry,
      ...(row.orgLogoUrl ? { logoUrl: row.orgLogoUrl } : {}),
      plan: row.orgPlan,
    },
    workspace: {
      id: row.wsId,
      organizationId: row.orgId,
      name: row.wsName,
      trustScore: row.wsTrustScore,
    },
    preferences: {
      // teamSize/briefingTime are text columns validated by the app (their
      // literal values aren't legal Postgres enum identifiers).
      teamSize: row.teamSize as UserPreferences['teamSize'],
      goals: row.goals,
      workStyle: row.workStyle,
      briefingTime: row.briefingTime as UserPreferences['briefingTime'],
      notificationLevel: row.notificationLevel,
    },
  };
}
