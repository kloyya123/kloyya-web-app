import { setClock } from '@/lib/clock';
import { MOCK_NOW } from '@/mock/organization';
import { MockAuthService } from './auth/mock-auth-service';
import type { AuthService } from './auth/types';
import { MockCalendarService } from './calendar/mock-calendar-service';
import type { CalendarService } from './calendar/types';
import { MockInboxService } from './inbox/mock-inbox-service';
import type { InboxService } from './inbox/types';
import { MockKnowledgeService } from './knowledge/mock-knowledge-service';
import type { KnowledgeService } from './knowledge/types';
import { MockProjectService } from './projects/mock-project-service';
import type { ProjectService } from './projects/types';
import { MockSearchService } from './search/mock-search-service';
import type { SearchService } from './search/types';
import { MockMeetingService } from './meetings/mock-meeting-service';
import type { MeetingService } from './meetings/types';
import { MockIntegrationsService } from './integrations/mock-integrations-service';
import type { IntegrationsService } from './integrations/types';
import { MockIntelligenceService } from './intelligence/mock-intelligence-service';
import type { IntelligenceService } from './intelligence/types';
import { MockNotificationService } from './notifications/mock-notification-service';
import type { NotificationService } from './notifications/types';
import { MockOrganizationService } from './organization/mock-organization-service';
import type { OrganizationService } from './organization/types';
import { MockSourcesService } from './sources/mock-sources-service';
import type { SourcesService } from './sources/types';
import { MockTaskService } from './tasks/mock-task-service';
import type { TaskService } from './tasks/types';

/**
 * The service registry — the single backend swap point.
 *
 * The Engineering Quality Gate sets the bar explicitly: "Only the data layer
 * should change when moving from mock data to production APIs." This file *is*
 * that data layer's seam.
 *
 * Attaching a real backend means writing `SupabaseAuthService implements
 * AuthService` and changing the one line below. No component, hook, page, or
 * test changes, because none of them ever names a concrete implementation.
 *
 * Instantiated once at module scope. These services are stateless request
 * builders; the session lives in a cookie, not in the object.
 */

export interface Services {
  auth: AuthService;
  intelligence: IntelligenceService;
  tasks: TaskService;
  sources: SourcesService;
  integrations: IntegrationsService;
  calendar: CalendarService;
  meetings: MeetingService;
  inbox: InboxService;
  knowledge: KnowledgeService;
  projects: ProjectService;
  organization: OrganizationService;
  search: SearchService;
  notifications: NotificationService;
}

/**
 * The mock data layer runs on a pinned narrative day, so the UI's "now" must be
 * that day too — otherwise Atlas's deadline ages into the past and the demo rots.
 * Installing it here, at the swap point, keeps the mock out of the UI entirely:
 * a real backend simply never calls this, and lib/clock falls back to wall time.
 */
setClock(() => MOCK_NOW);

export const services: Services = {
  auth: new MockAuthService(),
  intelligence: new MockIntelligenceService(),
  tasks: new MockTaskService(),
  sources: new MockSourcesService(),
  integrations: new MockIntegrationsService(),
  calendar: new MockCalendarService(),
  meetings: new MockMeetingService(),
  inbox: new MockInboxService(),
  knowledge: new MockKnowledgeService(),
  projects: new MockProjectService(),
  organization: new MockOrganizationService(),
  search: new MockSearchService(),
  notifications: new MockNotificationService(),
};

export type { AuthService } from './auth/types';
export type {
  DashboardData,
  DashboardMetrics,
  IntelligenceService,
} from './intelligence/types';
export type { SourcesService } from './sources/types';
export type {
  ConnectionSummary,
  IntegrationsService,
} from './integrations/types';
export type { CalendarService, ScheduleQuery } from './calendar/types';
export type { MeetingList, MeetingService } from './meetings/types';
export type { InboxList, InboxService } from './inbox/types';
export type { KnowledgeService } from './knowledge/types';
export type { ProjectDetail, ProjectList, ProjectService } from './projects/types';
export type {
  MemberProfile,
  OrgOverview,
  OrganizationService,
} from './organization/types';
export type { SearchService } from './search/types';
export type { NotificationService } from './notifications/types';
export type {
  TaskFilters,
  TaskListQuery,
  TaskService,
  TaskSortField,
} from './tasks/types';
export { ApiError, isApiError } from './http/errors';
export {
  configureMockTransport,
  getMockTransportConfig,
} from './http/mock-transport';
