import { z } from 'zod';
import {
  BRIEFING_TIMES,
  GOALS,
  NOTIFICATION_LEVELS,
  TEAM_SIZES,
  WORK_STYLES,
} from '@/services/auth/types';

/**
 * Settings validates the same values onboarding does, because they are the same
 * values — the vocabulary lives in one place (lib/preference-options) and the
 * rules in one place (here). A field Settings could set but onboarding would
 * reject is a bug waiting to happen.
 */
export const settingsSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter your name.').max(120, 'That name is too long.'),
  jobTitle: z
    .string()
    .trim()
    .min(1, 'Enter your role, for example “Chief Operating Officer”.')
    .max(120, 'That role is too long.'),
  companyName: z
    .string()
    .trim()
    .min(1, 'Enter your company name.')
    .max(120, 'That name is too long.'),
  industry: z.string().trim().min(1, 'Choose an industry.'),
  teamSize: z.enum(TEAM_SIZES),
  goals: z.array(z.enum(GOALS)),
  workStyle: z.enum(WORK_STYLES),
  briefingTime: z.enum(BRIEFING_TIMES),
  notificationLevel: z.enum(NOTIFICATION_LEVELS),
});

export type SettingsValues = z.infer<typeof settingsSchema>;
