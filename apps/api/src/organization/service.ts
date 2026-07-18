import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { withTenantScope } from '@kloyya/db/scope';
import { memberships, organizations, user, users, workspaces } from '@kloyya/db/schema';
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
 * boundary even if this function's own filters were wrong. Identities live in
 * Better Auth's `user` table, which the tenant role deliberately cannot touch —
 * so those are fetched separately, by the exact ids the scoped query already
 * authorized. Two steps, and neither one trusts the caller.
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

    // Everyone in this workspace, with the role they hold in it.
    const memberRows = await tx
      .select({
        id: users.id,
        organizationId: users.organizationId,
        jobTitle: users.jobTitle,
        timezone: users.timezone,
        hasCompletedOnboarding: users.hasCompletedOnboarding,
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

  // Identities: outside the tenant role's reach by design, so fetched here for
  // exactly the members the scoped query returned — no wider.
  const ids = scoped.memberRows.map((m) => m.id);
  const identities = ids.length
    ? await db
        .select({
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(inArray(user.id, ids))
    : [];
  const identityById = new Map(identities.map((i) => [i.id, i]));

  const members: User[] = scoped.memberRows
    .flatMap((row) => {
      const identity = identityById.get(row.id);
      // A profile whose identity vanished is a broken row, not a blank member.
      if (!identity) return [];
      return [
        {
          id: row.id,
          organizationId: row.organizationId,
          email: identity.email,
          fullName: identity.name,
          ...(identity.image ? { avatarUrl: identity.image } : {}),
          jobTitle: row.jobTitle,
          role: row.role,
          timezone: row.timezone,
          isEmailVerified: identity.emailVerified,
          hasCompletedOnboarding: row.hasCompletedOnboarding,
          createdAt: identity.createdAt.toISOString(),
        } satisfies User,
      ];
    })
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
