import { apiFetch } from '../http/transport';
import type { MemberProfile, OrganizationService, OrgOverview } from './types';

/**
 * The real OrganizationService.
 *
 * getOverview maps one-to-one onto GET /v1/organization, whose response the
 * backend built to this exact shape — the mock and the API were written to the
 * same contract, so this is a thin call, not a translation.
 */
export class HttpOrganizationService implements OrganizationService {
  async getOverview(): Promise<OrgOverview> {
    return apiFetch<OrgOverview>('/v1/organization');
  }

  /**
   * Not yet served by the API: it joins a member to the projects they own and
   * the tasks assigned to them, and those tables don't exist until Phase 9. The
   * backend deliberately did not ship a stub that returns empty arrays, and this
   * matches that honesty rather than papering over it — a member page that
   * silently shows nothing is worse than one that isn't there.
   */
  async getMember(_userId: string): Promise<MemberProfile> {
    throw new Error('Member profiles are not available yet — projects and tasks land in a later phase.');
  }
}
