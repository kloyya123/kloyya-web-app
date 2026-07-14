import type { BadgeTone } from '@/components/ui';
import type { Role } from '@/types/domain';

/**
 * Badge tone per role. The label itself comes from lib/org-roles (roleLabel);
 * this maps only how senior a role *reads*, and meaning stays in the label, not
 * the colour (WCAG 1.4.1). Anything not called out is neutral.
 */
const ROLE_TONES: Partial<Record<Role, BadgeTone>> = {
  owner: 'ai',
  administrator: 'ai',
  executive: 'ai',
  manager: 'primary',
  team_lead: 'primary',
  ai_service: 'info',
  automation_service: 'info',
};

export function roleTone(role: Role): BadgeTone {
  return ROLE_TONES[role] ?? 'neutral';
}
