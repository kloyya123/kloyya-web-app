import { describe, expect, it } from 'vitest';
import type { Role, User } from '@/types/domain';
import { bySeniority, roleLabel, roleRank } from './org-roles';

function user(overrides: Partial<User> & { id: string }): User {
  return {
    organizationId: 'org',
    email: 'u@example.com',
    fullName: 'User',
    jobTitle: 'Title',
    role: 'employee',
    timezone: 'UTC',
    isEmailVerified: true,
    hasCompletedOnboarding: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('roleRank', () => {
  it('ranks by seniority, most senior lowest', () => {
    expect(roleRank('owner')).toBeLessThan(roleRank('manager'));
    expect(roleRank('executive')).toBeLessThan(roleRank('employee'));
  });
});

describe('bySeniority', () => {
  it('orders most senior first, then alphabetically within a role', () => {
    const users = [
      user({ id: 'a', role: 'employee', fullName: 'Zoe' }),
      user({ id: 'b', role: 'executive', fullName: 'Amara' }),
      user({ id: 'c', role: 'manager', fullName: 'Priya' }),
      user({ id: 'd', role: 'manager', fullName: 'Daniel' }),
    ];
    const sorted = [...users].sort(bySeniority);
    expect(sorted.map((u) => u.fullName)).toEqual(['Amara', 'Daniel', 'Priya', 'Zoe']);
  });
});

describe('roleLabel', () => {
  it('turns a role token into human text', () => {
    expect(roleLabel('team_lead')).toBe('Team lead');
    expect(roleLabel('ai_service')).toBe('AI service');
    expect(roleLabel('executive')).toBe('Executive');
  });

  it('has a label for every role', () => {
    const roles: Role[] = [
      'owner',
      'administrator',
      'executive',
      'manager',
      'team_lead',
      'employee',
      'contractor',
      'guest',
      'auditor',
      'support',
      'ai_service',
      'automation_service',
    ];
    for (const role of roles) {
      expect(roleLabel(role).length).toBeGreaterThan(0);
    }
  });
});
