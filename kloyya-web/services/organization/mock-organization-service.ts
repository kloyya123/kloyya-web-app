import { bySeniority } from '@/lib/org-roles';
import {
  mockOrganization,
  mockProjects,
  mockTasks,
  mockTeammates,
  mockUser,
  mockWorkspace,
} from '@/mock/organization';
import { API_STATUS } from '@/types/api';
import { mockError, mockRespond } from '../http/mock-transport';
import type { MemberProfile, OrgOverview, OrganizationService } from './types';

/** The whole membership: the signed-in user plus everyone else. */
const allMembers = [mockUser, ...mockTeammates];

/**
 * Mock organization.
 *
 * Directory order is delegated to the pure org-roles policy (most senior first),
 * and a member profile is assembled here — projects joined by owner, tasks by
 * assignee — so a real backend swaps this one file without any component
 * learning where the join lived.
 */
export class MockOrganizationService implements OrganizationService {
  async getOverview(): Promise<OrgOverview> {
    const members = [...allMembers].sort(bySeniority);
    const { data } = await mockRespond<OrgOverview>({
      organization: mockOrganization,
      workspace: mockWorkspace,
      members,
      memberCount: members.length,
    });
    return data;
  }

  async getMember(userId: string): Promise<MemberProfile> {
    const user = allMembers.find((member) => member.id === userId);
    if (!user) {
      mockError(
        API_STATUS.NotFound,
        'member_not_found',
        'That person isn’t in this organization.',
        'They may have left, or the link may be out of date.',
        'Browse the organization for the current members.',
      );
    }

    const profile: MemberProfile = {
      user,
      ownedProjects: mockProjects.filter((project) => project.ownerId === user.id),
      tasks: mockTasks.filter((task) => task.ownerId === user.id),
    };

    const { data } = await mockRespond(profile);
    return data;
  }
}
