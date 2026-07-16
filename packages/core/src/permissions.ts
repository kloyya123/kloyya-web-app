import { ROLES, type Role } from './domain.js';

/**
 * RBAC — what each role may do.
 *
 * Lives in @kloyya/core because both ends need the same answer: the API refuses
 * the request, and the UI shouldn't offer a button that is going to be refused.
 * One matrix, so "can I?" cannot mean two different things.
 *
 * Scoped per the roadmap's Authorization phase: organization permissions and
 * workspace permissions. Everything is expressed as `subject:verb`, so a new
 * capability is a new string rather than a new mechanism.
 *
 * The matrix below is derived from the role names KESM defines and from what
 * each role plausibly needs; it is deliberately the least generous reading that
 * still lets each role work. It is also the single place to correct if a role
 * turns out to need more — never by scattering role checks through handlers.
 */
export const PERMISSIONS = [
  // Organization
  'org:read',
  'org:update',
  'org:delete',
  'billing:manage',
  // Members
  'member:read',
  'member:invite',
  'member:remove',
  'member:role:update',
  // Workspaces
  'workspace:read',
  'workspace:create',
  'workspace:update',
  'workspace:delete',
  // Integrations (Phase 8)
  'integration:connect',
  'integration:disconnect',
  // Audit (KESM: auditors read the record, they do not change it)
  'audit:read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Everything: the owner's set, written once. */
const ALL: readonly Permission[] = PERMISSIONS;

/** What any member of an organization can do simply by belonging to it. */
const MEMBER_BASELINE: readonly Permission[] = ['org:read', 'member:read', 'workspace:read'];

/** Read-only oversight: sees the organization and its record, changes nothing. */
const OVERSIGHT: readonly Permission[] = [...MEMBER_BASELINE, 'audit:read'];

/**
 * Role → permissions.
 *
 * Notable boundaries, each deliberate:
 *  • Only the owner may delete the organization or touch billing — an
 *    administrator can run the company's Kloyya, not end it or spend its money.
 *  • auditor and support are read-only by construction. Support can look at an
 *    organization to help it; that is not licence to change it.
 *  • contractor and guest are outside the org's trust boundary: a guest sees the
 *    workspace it was invited to and nothing about the wider organization.
 *  • The machine principals get exactly what they need to reason and act, and
 *    are authorized and audited like any user — an agent is a principal, not a
 *    loophole. ai_service reads; automation_service reads and connects tools.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: ALL,
  administrator: [
    'org:read',
    'org:update',
    'member:read',
    'member:invite',
    'member:remove',
    'member:role:update',
    'workspace:read',
    'workspace:create',
    'workspace:update',
    'workspace:delete',
    'integration:connect',
    'integration:disconnect',
    'audit:read',
  ],
  executive: [...MEMBER_BASELINE, 'workspace:create', 'integration:connect', 'audit:read'],
  manager: [...MEMBER_BASELINE, 'member:invite', 'workspace:create', 'integration:connect'],
  team_lead: [...MEMBER_BASELINE, 'workspace:create', 'integration:connect'],
  employee: [...MEMBER_BASELINE, 'integration:connect'],
  contractor: ['workspace:read', 'member:read'],
  guest: ['workspace:read'],
  auditor: OVERSIGHT,
  support: OVERSIGHT,
  ai_service: [...MEMBER_BASELINE],
  automation_service: [...MEMBER_BASELINE, 'integration:connect'],
};

/** Whether a role holds a permission. The only way to ask. */
export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Every permission a role holds — for the UI to gate on, or an audit to report. */
export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

/**
 * Roles that can never change anything, whatever else they may see. Useful for
 * saying so in the interface rather than letting someone discover it by being
 * refused.
 */
export const READ_ONLY_ROLES: readonly Role[] = ROLES.filter(
  (role) => !ROLE_PERMISSIONS[role].some((p) => p !== 'audit:read' && !p.endsWith(':read')),
);
