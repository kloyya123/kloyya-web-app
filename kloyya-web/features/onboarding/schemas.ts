import { z } from 'zod';
import {
  BRIEFING_TIMES,
  GOALS,
  NOTIFICATION_LEVELS,
  TEAM_SIZES,
  WORK_STYLES,
} from '@/services/auth/types';

/**
 * One schema per step, composed into the whole.
 *
 * Per-step schemas let the wizard validate only what the user has actually seen.
 * Validating the full profile on step one would flag every field they have not
 * reached yet, which is precisely the "punitive" validation KDS forbids.
 */

export const aboutYouSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter your name.').max(120, 'That name is too long.'),
  jobTitle: z
    .string()
    .trim()
    .min(1, 'Enter your role, for example “Chief Operating Officer”.')
    .max(120, 'That role is too long.'),
});

export const yourCompanySchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(1, 'Enter your company name.')
    .max(160, 'That name is too long.'),
  industry: z.string().min(1, 'Choose the closest industry.'),
  teamSize: z.enum(TEAM_SIZES),
});

export const yourGoalsSchema = z.object({
  // At least one. Kloyya ranks against goals; with none, everything ties.
  goals: z.array(z.enum(GOALS)).min(1, 'Choose at least one. You can change this later.'),
});

export const howYouWorkSchema = z.object({
  workStyle: z.enum(WORK_STYLES),
  briefingTime: z.enum(BRIEFING_TIMES),
  notificationLevel: z.enum(NOTIFICATION_LEVELS),
});

export const onboardingSchema = aboutYouSchema
  .extend(yourCompanySchema.shape)
  .extend(yourGoalsSchema.shape)
  .extend(howYouWorkSchema.shape);

export type OnboardingValues = z.infer<typeof onboardingSchema>;

/** The fields each step owns, used to scope validation on "Continue". */
export const STEP_FIELDS = {
  'about-you': ['fullName', 'jobTitle'],
  'your-company': ['companyName', 'industry', 'teamSize'],
  'your-goals': ['goals'],
  'how-you-work': ['workStyle', 'briefingTime', 'notificationLevel'],
} as const satisfies Record<string, ReadonlyArray<keyof OnboardingValues>>;
