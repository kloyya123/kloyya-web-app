import { and, eq, isNull } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import {
  memberships,
  organizations,
  userPreferences,
  users,
  workspaces,
} from '@kloyya/db/schema';
import type { Organization, User, UserPreferences, Workspace } from '@kloyya/core';
import type { Identity } from '../auth/identity';

/**
 * Compose the domain `User` — the shape the frontend already types in
 * @kloyya/core — out of the caller's Supabase identity plus the tables that own
 * the rest of it:
 *
 *   identity     → email, name, verification            [Supabase Auth]
 *   users        → profile (org, full name, job title, timezone, onboarding)
 *   memberships  → the role the user holds *in their active workspace*
 *
 * Identity is INJECTED, not queried: the email and verification state come from
 * the validated Supabase JWT, never from a table. `users.full_name` is the
 * canonical display name (editable in Settings); the JWT's name is the fallback
 * for a just-provisioned account. This is what lets the API be tested with a
 * fabricated identity over an in-memory database, with no auth server present.
 *
 * Returns null when no profile exists for the identity — a user that exists in
 * Supabase but was never provisioned here.
 */
export async function composeUser(db: AppDb, identity: Identity): Promise<User | null> {
  const rows = await db
    .select({
      organizationId: users.organizationId,
      fullName: users.fullName,
      jobTitle: users.jobTitle,
      timezone: users.timezone,
      hasCompletedOnboarding: users.hasCompletedOnboarding,
      createdAt: users.createdAt,
      role: memberships.role,
    })
    .from(users)
    // The membership for the workspace the user currently has open. Left-joined:
    // a profile without an active workspace still yields a User.
    .leftJoin(
      memberships,
      and(eq(memberships.userId, users.id), eq(memberships.workspaceId, users.activeWorkspaceId)),
    )
    .where(and(eq(users.id, identity.id), isNull(users.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: identity.id,
    organizationId: row.organizationId,
    email: identity.email,
    fullName: row.fullName || identity.fullName || '',
    jobTitle: row.jobTitle,
    role: row.role ?? 'employee',
    timezone: row.timezone,
    isEmailVerified: identity.emailVerified,
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
  identity: Identity,
): Promise<AccountSession | null> {
  const composed = await composeUser(db, identity);
  if (!composed) return null;

  const rows = await db
    .select({
      orgId: organizations.id,
      orgName: organizations.name,
      orgIndustry: organizations.industry,
      orgLogoUrl: organizations.logoUrl,
      orgPlan: organizations.plan,
      orgSubscriptionTier: organizations.subscriptionTier,
      wsId: workspaces.id,
      wsName: workspaces.name,
      wsTrustScore: workspaces.trustScore,
      role: userPreferences.role,
      priorities: userPreferences.priorities,
      proactiveness: userPreferences.proactiveness,
      teamSize: userPreferences.teamSize,
      goals: userPreferences.goals,
      workStyle: userPreferences.workStyle,
      briefingTime: userPreferences.briefingTime,
      notificationLevel: userPreferences.notificationLevel,
      aiDraftingEnabled: userPreferences.aiDraftingEnabled,
    })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.organizationId))
    .innerJoin(workspaces, eq(workspaces.id, users.activeWorkspaceId))
    .innerJoin(userPreferences, eq(userPreferences.userId, users.id))
    .where(eq(users.id, identity.id))
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
      subscriptionTier: row.orgSubscriptionTier,
    },
    workspace: {
      id: row.wsId,
      organizationId: row.orgId,
      name: row.wsName,
      trustScore: row.wsTrustScore,
    },
    preferences: {
      role: row.role,
      goals: row.goals,
      priorities: row.priorities,
      proactiveness: row.proactiveness,
      // teamSize/briefingTime are text columns validated by the app (their
      // literal values aren't legal Postgres enum identifiers).
      teamSize: row.teamSize as UserPreferences['teamSize'],
      workStyle: row.workStyle,
      briefingTime: row.briefingTime as UserPreferences['briefingTime'],
      notificationLevel: row.notificationLevel,
      aiDraftingEnabled: row.aiDraftingEnabled,
    },
  };
}
