import { describe, expect, it } from 'vitest';
import type { Project } from '@/types/domain';
import { byHealthAsc, daysUntil, healthBand } from './project-health';

function project(overrides: Partial<Project> & { id: string }): Project {
  return {
    organizationId: 'org',
    workspaceId: 'ws',
    createdBy: 'u',
    updatedBy: 'u',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    version: 1,
    name: 'Project',
    status: 'active',
    ownerId: 'u',
    progress: 50,
    riskScore: 20,
    healthScore: 80,
    ...overrides,
  };
}

describe('healthBand', () => {
  it('bands the score', () => {
    expect(healthBand(91)).toBe('strong');
    expect(healthBand(75)).toBe('strong');
    expect(healthBand(54)).toBe('fair');
    expect(healthBand(50)).toBe('fair');
    expect(healthBand(49)).toBe('poor');
  });

  it('clamps out-of-range scores rather than inventing a band', () => {
    expect(healthBand(140)).toBe('strong');
    expect(healthBand(-5)).toBe('poor');
  });
});

describe('byHealthAsc', () => {
  it('sorts worst health first, so the project that needs attention surfaces', () => {
    const projects = [
      project({ id: 'strong', healthScore: 91 }),
      project({ id: 'poor', healthScore: 54 }),
      project({ id: 'mid', healthScore: 82 }),
    ];
    const sorted = [...projects].sort(byHealthAsc);
    expect(sorted.map((p) => p.id)).toEqual(['poor', 'mid', 'strong']);
  });
});

describe('daysUntil', () => {
  const now = new Date('2026-07-10T08:00:00.000Z');

  it('counts whole days ahead', () => {
    expect(daysUntil('2026-07-13T08:00:00.000Z', now)).toBe(3);
  });

  it('is negative for a passed deadline', () => {
    expect(daysUntil('2026-07-08T08:00:00.000Z', now)).toBe(-2);
  });

  it('returns null for a missing deadline', () => {
    expect(daysUntil(undefined, now)).toBeNull();
  });
});
