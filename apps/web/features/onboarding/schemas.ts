import { z } from 'zod';
import { GOALS, PROACTIVENESS, SUBSCRIPTION_TIERS } from '@/services/auth/types';

/**
 * One schema per step, composed into the whole.
 *
 * Per-step schemas let the wizard validate only what the user has actually seen.
 * Validating the full profile on step one would flag every field they have not
 * reached yet, which is precisely the "punitive" validation KDS forbids.
 */

export const welcomeSchema = z.object({
  // Welcome screen has no fields — always valid.
});

export const nameSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter your name.').max(120, 'That name is too long.'),
});

export const roleSchema = z.object({
  role: z
    .string()
    .trim()
    .min(1, 'Pick the closest role, or type your own.')
    .max(120, 'That role is too long.'),
});

export const industrySchema = z.object({
  industry: z.string().min(1, 'Pick your industry or field.').max(120),
  fieldOfStudy: z.string().max(120).optional(),
});

export const helpSchema = z.object({
  // At least one. Kloyya ranks against these; with none, everything ties.
  goals: z.array(z.enum(GOALS)).min(1, 'Choose at least one. You can change this later.'),
});

export const prioritiesSchema = z.object({
  // Optional — some people arrive without a list, and that's fine.
  priorities: z.array(z.string().trim().min(1).max(120)).max(20, "That's plenty for now."),
});

export const proactivenessSchema = z.object({
  proactiveness: z.enum(PROACTIVENESS),
});

export const privacySchema = z.object({
  privacyAcknowledged: z.boolean().refine((val) => val, 'You must acknowledge our privacy practices to continue.'),
});

export const planSchema = z.object({
  plan: z.enum(SUBSCRIPTION_TIERS),
});

export const onboardingSchema = welcomeSchema
  .extend(nameSchema.shape)
  .extend(roleSchema.shape)
  .extend(industrySchema.shape)
  .extend(helpSchema.shape)
  .extend(prioritiesSchema.shape)
  .extend(proactivenessSchema.shape)
  .extend(privacySchema.shape)
  .extend(planSchema.shape);

export type OnboardingValues = z.infer<typeof onboardingSchema>;

/** The fields each step owns, used to scope validation on "Continue". */
export const STEP_FIELDS = {
  welcome: [],
  name: ['fullName'],
  role: ['role'],
  industry: ['industry', 'fieldOfStudy'],
  help: ['goals'],
  priorities: ['priorities'],
  proactiveness: ['proactiveness'],
  privacy: ['privacyAcknowledged'],
  // No `plan` entry: the plan step is hidden until billing exists. `plan` is
  // still part of the submitted values, defaulted to 'free' by the wizard.
} as const satisfies Record<string, ReadonlyArray<keyof OnboardingValues>>;
