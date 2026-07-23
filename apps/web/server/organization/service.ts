import { and, eq, isNull } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { withTenantScope } from '@kloyya/db/scope';
import { memberships, organizations, users, workspaces } from '@kloyya/db/schema';
import { ROLES, type Organization, type Role, type User, type Workspace } from '@kloyya/core';

/**
 * The organization overview — the shape the frontend's OrganizationService
 * already declares, so only the transport changes.
 */
export interface OrgOverview {
  organization: Organization;
  workspace: Workspace;
  /** Members, most senior first. */
  members: User[];
  memberCount: number;
}

/**
 * Seniority is ROLES' declaration order (owner → … → machine principals), which
 * both ends already share. An unrecognized role sorts last rather than throwing
 * a directory away.
 */
function roleRank(role: Role): number {
  const index = ROLES.indexOf(role);
  return index === -1 ? ROLES.length : index;
}

/**
 * Everything the organization page needs, for the caller's own organization.
 *
 * The org id is never taken from the request — it is read from the caller's own
 * profile. There is no parameter here for a client to tamper with, which is the
 * property that actually prevents one tenant asking for another's directory.
 *
 * The tenant tables are read inside `withTenantScope`, so Postgres enforces the
 * boundary even if this function's own filters were wrong. Identity is now
 * denormalized onto the `users` profile (email, full name), so a member's
 * display fields come from the same scoped query — no second, unscoped lookup
 * into an auth table that no longer exists here.
 */
export async function getOrgOverview(db: AppDb, authUserId: string): Promise<OrgOverview | null> {
  const [profile] = await db
    .select({ organizationId: users.organizationId, activeWorkspaceId: users.activeWorkspaceId })
    .from(users)
    .where(and(eq(users.id, authUserId), isNull(users.deletedAt)))
    .limit(1);

  if (!profile?.activeWorkspaceId) return null;
  const { organizationId, activeWorkspaceId } = profile;

  const scoped = await withTenantScope(db, organizationId, async (tx) => {
    const [org] = await tx
      .select({
        id: organizations.id,
        name: organizations.name,
        industry: organizations.industry,
        logoUrl: organizations.logoUrl,
        plan: organizations.plan,
        subscriptionTier: organizations.subscriptionTier,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    const [workspace] = await tx
      .select({
        id: workspaces.id,
        organizationId: workspaces.organizationId,
        name: workspaces.name,
        trustScore: workspaces.trustScore,
      })
      .from(workspaces)
      .where(eq(workspaces.id, activeWorkspaceId))
      .limit(1);

    // Everyone in this workspace, with the role they hold in it. Identity fields
    // (email, full name) are denormalized onto the profile, so one query does it.
    const memberRows = await tx
      .select({
        id: users.id,
        organizationId: users.organizationId,
        email: users.email,
        fullName: users.fullName,
        jobTitle: users.jobTitle,
        timezone: users.timezone,
        hasCompletedOnboarding: users.hasCompletedOnboarding,
        createdAt: users.createdAt,
        role: memberships.role,
      })
      .from(users)
      .innerJoin(
        memberships,
        and(eq(memberships.userId, users.id), eq(memberships.workspaceId, activeWorkspaceId)),
      )
      .where(isNull(users.deletedAt));

    return { org, workspace, memberRows };
  });

  if (!scoped.org || !scoped.workspace) return null;

  const members: User[] = scoped.memberRows
    .map(
      (row) =>
        ({
          id: row.id,
          organizationId: row.organizationId,
          email: row.email,
          fullName: row.fullName,
          jobTitle: row.jobTitle,
          role: row.role,
          timezone: row.timezone,
          // A provisioned, onboarded member reached this state through a verified
          // Supabase session; per-member verification isn't re-checked here.
          isEmailVerified: true,
          hasCompletedOnboarding: row.hasCompletedOnboarding,
          createdAt: row.createdAt.toISOString(),
        }) satisfies User,
    )
    .sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.fullName.localeCompare(b.fullName));

  return {
    organization: {
      id: scoped.org.id,
      name: scoped.org.name,
      industry: scoped.org.industry,
      ...(scoped.org.logoUrl ? { logoUrl: scoped.org.logoUrl } : {}),
      plan: scoped.org.plan,
      subscriptionTier: scoped.org.subscriptionTier,
    },
    workspace: {
      id: scoped.workspace.id,
      organizationId: scoped.workspace.organizationId,
      name: scoped.workspace.name,
      trustScore: scoped.workspace.trustScore,
    },
    members,
    memberCount: members.length,
  };
}
