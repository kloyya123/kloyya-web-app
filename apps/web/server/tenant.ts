import { eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { users } from '@kloyya/db/schema';

/**
 * Where the caller stands: their tenant coordinates.
 *
 * Every workspace-scoped service takes this. It is resolved from the caller's
 * identity (never from client input) — the session names the user, the user's
 * profile names the organization and active workspace, and RLS enforces the
 * rest.
 *
 * (Previously defined in the API's integrations/connect.ts; it belongs to the
 * tenant layer, not the connectors, so the port moved it here.)
 */
export interface StartContext {
  userId: string;
  workspaceId: string;
  organizationId: string;
}

export async function resolveStartContext(
  db: AppDb,
  authUserId: string,
): Promise<StartContext | null> {
  const [row] = await db
    .select({ organizationId: users.organizationId, workspaceId: users.activeWorkspaceId })
    .from(users)
    .where(eq(users.id, authUserId))
    .limit(1);
  if (!row?.workspaceId) return null;
  return {
    userId: authUserId,
    workspaceId: row.workspaceId,
    organizationId: row.organizationId,
  };
}
