import { eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { userPreferences } from '@kloyya/db/schema';
import type { StartContext } from '../tenant';

/**
 * Just the one field callers outside of composeSession need to check —
 * "may Kloyya draft for this user" — without pulling the full preferences
 * join composeSession does for the session response.
 */
export interface DraftingPreferences {
  aiDraftingEnabled: boolean;
}

export async function readPreferences(
  db: AppDb,
  ctx: StartContext,
): Promise<DraftingPreferences | null> {
  const rows = await db
    .select({ aiDraftingEnabled: userPreferences.aiDraftingEnabled })
    .from(userPreferences)
    .where(eq(userPreferences.userId, ctx.userId))
    .limit(1);
  return rows[0] ?? null;
}
