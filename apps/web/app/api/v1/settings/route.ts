import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  BRIEFING_TIMES,
  GOALS,
  NOTIFICATION_LEVELS,
  TEAM_SIZES,
  WORK_STYLES,
} from '@kloyya/core';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { assertPermission } from '@server/auth/permission';
import { updateSettings } from '@server/users/onboarding';
import { composeSession } from '@server/users/service';
import { syncMetadataName } from '@server/users/metadata';

/**
 * Settings.
 *
 * A patch: every field optional, an absent field means "leave it alone". The
 * enum members come from the same @kloyya/core constants the Settings form
 * renders. Email is display-only (owned by Supabase Auth), so it is not a field
 * here. Renaming the company needs the org:update permission, checked inside the
 * service where the body — not just the route — is visible.
 */
const settingsSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  companyName: z.string().trim().min(1).max(200).optional(),
  industry: z.string().trim().min(1).max(120).optional(),
  preferences: z
    .object({
      teamSize: z.enum(TEAM_SIZES).optional(),
      goals: z.array(z.enum(GOALS)).optional(),
      workStyle: z.enum(WORK_STYLES).optional(),
      briefingTime: z.enum(BRIEFING_TIMES).optional(),
      notificationLevel: z.enum(NOTIFICATION_LEVELS).optional(),
    })
    .optional(),
});

export const PATCH = kasRoute('verified', async (req, ctx) => {
  const patch = settingsSchema.parse((await req.json().catch(() => ({}))) ?? {});

  // Authorization depends on the body, not the route: your own job title and the
  // organization's name arrive at the same endpoint. Renaming the company is a
  // different act, refused out loud (403) rather than silently ignored.
  if (patch.companyName !== undefined || patch.industry !== undefined) {
    await assertPermission(ctx.db, ctx.identity.id, 'org:update');
  }

  const updated = await updateSettings(ctx.db, ctx.identity.id, patch);
  if (!updated) throw errors.notFound('User profile');

  if (patch.fullName !== undefined) {
    await syncMetadataName(ctx.identity.id, patch.fullName);
  }

  const session = await composeSession(ctx.db, ctx.identity);
  if (!session) throw errors.notFound('User profile');

  return NextResponse.json(ok(session, ctx.correlationId));
});
