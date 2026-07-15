import { beforeEach, describe, expect, it } from 'vitest';
import { isApiError } from '../http/errors';
import { configureMockTransport } from '../http/mock-transport';
import { MockOrganizationService } from './mock-organization-service';

describe('MockOrganizationService', () => {
  const service = new MockOrganizationService();

  beforeEach(() => {
    configureMockTransport({ instant: true, failureRate: 0 });
  });

  describe('getOverview', () => {
    it('returns the org, workspace, and members most-senior-first', async () => {
      const { organization, workspace, members, memberCount } = await service.getOverview();
      expect(organization.name).toBe('Northwind Robotics');
      expect(workspace.trustScore).toBeGreaterThan(0);
      expect(members.length).toBe(memberCount);
      // Amara is the executive and must lead the directory.
      expect(members[0]?.id).toBe('user_amara');
    });
  });

  describe('getMember', () => {
    it('attaches the projects a member owns and their tasks', async () => {
      const profile = await service.getMember('user_daniel');
      expect(profile.user.fullName).toBe('Daniel Reyes');
      expect(profile.ownedProjects.some((p) => p.id === 'proj_atlas')).toBe(true);
      expect(profile.ownedProjects.every((p) => p.ownerId === 'user_daniel')).toBe(true);
      expect(profile.tasks.every((t) => t.ownerId === 'user_daniel')).toBe(true);
    });

    it('resolves the signed-in user as a member too', async () => {
      const profile = await service.getMember('user_amara');
      expect(profile.user.role).toBe('executive');
    });

    it('throws a non-retryable 404 for an unknown member', async () => {
      await expect(service.getMember('user_nope')).rejects.toSatisfy(
        (error: unknown) => isApiError(error) && error.httpStatus === 404 && !error.isRetryable,
      );
    });
  });
});
