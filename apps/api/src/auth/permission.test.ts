import { describe, expect, it } from 'vitest';
import { ROLES, type Role } from '@kloyya/core';
import { can, permissionsFor, PERMISSIONS, ROLE_PERMISSIONS } from '@kloyya/core/permissions';

/**
 * The permission matrix is security policy, so it is asserted rather than
 * trusted. These tests are deliberately about *boundaries* — the places where
 * getting it wrong is expensive — not a restatement of every cell.
 */
describe('permission matrix', () => {
  it('covers every role KESM defines', () => {
    for (const role of ROLES) {
      expect(ROLE_PERMISSIONS[role], `no permissions declared for "${role}"`).toBeDefined();
    }
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual([...ROLES].sort());
  });

  it('grants the owner everything', () => {
    for (const permission of PERMISSIONS) {
      expect(can('owner', permission), `owner should hold ${permission}`).toBe(true);
    }
  });

  it('reserves ending the organization and spending its money to the owner alone', () => {
    const dangerous = ['org:delete', 'billing:manage'] as const;
    for (const permission of dangerous) {
      const holders = ROLES.filter((role) => can(role, permission));
      expect(holders, `${permission} must be owner-only`).toEqual(['owner']);
    }
  });

  it('lets an administrator run the organization but not end it', () => {
    expect(can('administrator', 'org:update')).toBe(true);
    expect(can('administrator', 'member:invite')).toBe(true);
    expect(can('administrator', 'member:role:update')).toBe(true);
    expect(can('administrator', 'workspace:delete')).toBe(true);
    // The boundary that matters.
    expect(can('administrator', 'org:delete')).toBe(false);
    expect(can('administrator', 'billing:manage')).toBe(false);
  });

  it('keeps oversight roles read-only', () => {
    for (const role of ['auditor', 'support'] as const) {
      expect(can(role, 'audit:read')).toBe(true);
      expect(can(role, 'org:read')).toBe(true);
      // Looking at an organization is not licence to change it.
      expect(can(role, 'org:update')).toBe(false);
      expect(can(role, 'member:remove')).toBe(false);
      expect(can(role, 'workspace:update')).toBe(false);
      expect(can(role, 'integration:connect')).toBe(false);
    }
  });

  it('keeps a guest outside the organization', () => {
    expect(can('guest', 'workspace:read')).toBe(true);
    // A guest was invited to a workspace, not told about the company.
    expect(can('guest', 'org:read')).toBe(false);
    expect(can('guest', 'member:read')).toBe(false);
    expect(permissionsFor('guest')).toHaveLength(1);
  });

  it('authorizes machine principals like users — no loopholes', () => {
    // An agent is a principal, not an exception: it reads to reason, and cannot
    // quietly restructure the organization it reasons about.
    for (const role of ['ai_service', 'automation_service'] as const) {
      expect(can(role, 'workspace:read')).toBe(true);
      expect(can(role, 'org:update')).toBe(false);
      expect(can(role, 'org:delete')).toBe(false);
      expect(can(role, 'member:remove')).toBe(false);
      expect(can(role, 'billing:manage')).toBe(false);
    }
    // automation_service acts on tools; ai_service only reasons.
    expect(can('automation_service', 'integration:connect')).toBe(true);
    expect(can('ai_service', 'integration:connect')).toBe(false);
  });

  it('gives every human member of the org the baseline needed to work', () => {
    const insiders: Role[] = ['owner', 'administrator', 'executive', 'manager', 'team_lead', 'employee'];
    for (const role of insiders) {
      expect(can(role, 'org:read'), `${role} should read the org`).toBe(true);
      expect(can(role, 'workspace:read'), `${role} should read its workspace`).toBe(true);
      expect(can(role, 'member:read'), `${role} should see colleagues`).toBe(true);
    }
  });

  it('declares no permission outside the known set', () => {
    const known = new Set<string>(PERMISSIONS);
    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(known.has(permission), `unknown permission "${permission}" on ${role}`).toBe(true);
      }
    }
  });
});
