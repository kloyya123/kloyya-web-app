import type { Organization, Project, Task, User, Workspace } from '@/types/domain';

export interface OrgOverview {
  organization: Organization;
  workspace: Workspace;
  /** Members, most senior first. */
  members: User[];
  memberCount: number;
}

/** A member with the work they own attached. */
export interface MemberProfile {
  user: User;
  ownedProjects: Project[];
  tasks: Task[];
}

/**
 * The organization contract.
 *
 * A real backend reads tenancy and membership (KESM) and joins a member to the
 * projects they own and the tasks assigned to them. The shape here is that end
 * state; only the transport changes.
 */
export interface OrganizationService {
  getOverview(): Promise<OrgOverview>;

  /** Throws 404 for an unknown member id. */
  getMember(userId: string): Promise<MemberProfile>;
}
