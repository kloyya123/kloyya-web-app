import { z } from 'zod';
import { GOALS, PROACTIVENESS, SUBSCRIPTION_TIERS } from '@/services/auth/types';

/**
 * One schema per step, composed into the whole.
 *
 * Per-step schemas let the wizard validate only what the user has actually seen.
 * Validating the full profile on step one would flag every field they have not
 * reached yet, which is precisely the "punitive" validation KDS forbids.
 *
 * The beta onboarding is short: role, what to help with, priorities, how
 * proactive, and a plan. The name comes from sign-up, so it isn't re-asked.
 */

export const roleSchema = z.object({
  role: z
    .string()
    .trim()
    .min(1, 'Pick the closest role, or type your own.')
    .max(120, 'That role is too long.'),
});

export const helpSchema = z.object({
  // At least one. Kloyya ranks against these; with none, everything ties.
  goals: z.array(z.enum(GOALS)).min(1, 'Choose at least one. You can change this later.'),
});

export const prioritiesSchema = z.object({
  // Optional — some people arrive without a list, and that's fine.
  priorities: z.array(z.string().trim().min(1).max(120)).max(20, 'That’s plenty for now.'),
});

export const proactivenessSchema = z.object({
  proactiveness: z.enum(PROACTIVENESS),
});

export const planSchema = z.object({
  plan: z.enum(SUBSCRIPTION_TIERS),
});

export const onboardingSchema = roleSchema
  .extend(helpSchema.shape)
  .extend(prioritiesSchema.shape)
  .extend(proactivenessSchema.shape)
  .extend(planSchema.shape)
  // fullName rides along from sign-up; the wizard seeds it and submits it, but no
  // step asks for it.
  .extend({ fullName: z.string().trim().min(1).max(120) });

export type OnboardingValues = z.infer<typeof onboardingSchema>;

/** The fields each step owns, used to scope validation on "Continue". */
export const STEP_FIELDS = {
  role: ['role'],
  help: ['goals'],
  priorities: ['priorities'],
  proactiveness: ['proactiveness'],
  plan: ['plan'],
} as const satisfies Record<string, ReadonlyArray<keyof OnboardingValues>>;
