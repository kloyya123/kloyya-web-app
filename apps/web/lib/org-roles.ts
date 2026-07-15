import { ROLES, type Role, type User } from '@/types/domain';

/**
 * Role seniority and presentation — the one place the people directory decides
 * order and wording.
 *
 * `ROLES` is already declared most-senior-first (owner → … → employee → machine
 * principals), so rank is simply its index. Keeping the comparator here means
 * the directory ordering is a tested policy, not an ad-hoc sort scattered across
 * components.
 */

export function roleRank(role: Role): number {
  const index = ROLES.indexOf(role);
  // An unknown role sorts last rather than crashing the directory.
  return index === -1 ? ROLES.length : index;
}

/** Most senior first; alphabetical by name within the same role. */
export function bySeniority(a: User, b: User): number {
  return roleRank(a.role) - roleRank(b.role) || a.fullName.localeCompare(b.fullName);
}

const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  administrator: 'Administrator',
  executive: 'Executive',
  manager: 'Manager',
  team_lead: 'Team lead',
  employee: 'Employee',
  contractor: 'Contractor',
  guest: 'Guest',
  auditor: 'Auditor',
  support: 'Support',
  ai_service: 'AI service',
  automation_service: 'Automation service',
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}
