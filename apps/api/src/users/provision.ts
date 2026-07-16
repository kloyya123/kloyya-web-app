import type { AppDb } from '@kloyya/db';
import { memberships, organizations, userPreferences, users, workspaces } from '@kloyya/db/schema';

/**
 * Provision a tenant for a newly created auth user.
 *
 * Better Auth creates the identity (`user`); everything that makes that identity
 * a *tenant* is created here, in one transaction: an organization, its first
 * workspace, the domain profile (1:1 with the auth user), an owner membership,
 * and default preferences.
 *
 * Why at sign-up rather than at onboarding: the frontend's session model — which
 * the mock service already encodes — expects `user.organizationId`, an
 * organization and a workspace to exist from the moment a session does, and only
 * gates the dashboard on `hasCompletedOnboarding`. Deferring tenant creation to
 * onboarding would leave a signed-in user with no org to belong to.
 *
 * The org is deliberately a placeholder: self-service sign-up doesn't know the
 * company yet. Onboarding names it (companyName/industry) and flips
 * `hasCompletedOnboarding`.
 *
 * The person who creates an organization owns it — hence role `owner`, not the
 * `employee` the mock defaults to (a mock simplification with no org to own).
 */
export interface NewAuthUser {
  id: string;
  name: string;
}

export async function provisionTenantForUser(db: AppDb, authUser: NewAuthUser): Promise<void> {
  const displayName = authUser.name.trim();
  const orgName = displayName.length > 0 ? `${displayName}'s Organization` : 'My Organization';

  await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      // industry is NOT NULL with no default; onboarding supplies the real value.
      .values({ name: orgName, industry: '' })
      .returning({ id: organizations.id });
    if (!org) throw new Error('Tenant provisioning failed: organization not created.');

    const [workspace] = await tx
      .insert(workspaces)
      .values({ organizationId: org.id, name: 'General' })
      .returning({ id: workspaces.id });
    if (!workspace) throw new Error('Tenant provisioning failed: workspace not created.');

    // The profile shares the auth user's id (1:1).
    await tx
      .insert(users)
      .values({ id: authUser.id, organizationId: org.id, activeWorkspaceId: workspace.id });

    await tx.insert(memberships).values({
      organizationId: org.id,
      workspaceId: workspace.id,
      userId: authUser.id,
      role: 'owner',
    });

    await tx.insert(userPreferences).values({ userId: authUser.id });
  });
}
