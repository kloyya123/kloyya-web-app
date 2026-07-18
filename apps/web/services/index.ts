import { setClock } from '@/lib/clock';
import { MOCK_NOW } from '@/mock/organization';
import { MockAskService } from './ask/mock-ask-service';
import { HttpAskService } from './ask/http-ask-service';
import type { AskService } from './ask/types';
import { MockAuthService } from './auth/mock-auth-service';
import { HttpAuthService } from './auth/http-auth-service';
import type { AuthService } from './auth/types';
import { MockBillingService } from './billing/mock-billing-service';
import { HttpBillingService } from './billing/http-billing-service';
import type { BillingService } from './billing/types';
import { MockDocumentService } from './documents/mock-documents-service';
import { HttpDocumentService } from './documents/http-documents-service';
import type { DocumentService } from './documents/types';
import { MockFeedbackService } from './feedback/mock-feedback-service';
import { HttpFeedbackService } from './feedback/http-feedback-service';
import type { FeedbackService } from './feedback/types';
import { MockDraftService } from './drafts/mock-drafts-service';
import { HttpDraftService } from './drafts/http-drafts-service';
import type { DraftService } from './drafts/types';
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
import { HttpIntegrationsService } from './integrations/http-integrations-service';
import type { IntegrationsService } from './integrations/types';
import { MockIntelligenceService } from './intelligence/mock-intelligence-service';
import type { IntelligenceService } from './intelligence/types';
import { MockNotificationService } from './notifications/mock-notification-service';
import type { NotificationService } from './notifications/types';
import { MockOrganizationService } from './organization/mock-organization-service';
import { HttpOrganizationService } from './organization/http-organization-service';
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
  ask: AskService;
  billing: BillingService;
  drafts: DraftService;
  documents: DocumentService;
  feedback: FeedbackService;
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
 * Which services talk to the real backend.
 *
 * `NEXT_PUBLIC_USE_REAL_API=true` flips the built connectors on. It defaults OFF,
 * so the demo, the test suite, and anyone without a running API keep the mock
 * layer — the 527 tests stay green because they never touch this branch.
 *
 * Only the services with a real backend are switched; the rest (tasks, calendar,
 * meetings, inbox, knowledge, projects, search, notifications, intelligence,
 * sources) have no API yet and stay on the mock until their phases land. Mixing
 * is fine on purpose: a page reading real auth and mock tasks is exactly the
 * incremental cut-over the frontend-first architecture was built to allow.
 */
const USE_REAL_API = process.env['NEXT_PUBLIC_USE_REAL_API'] === 'true';

/**
 * The pinned narrative "now" is a property of the MOCK dataset — Atlas's deadline
 * only makes sense on the demo day. With the real backend, time is real, so the
 * clock is only frozen when the mocks are actually in use.
 */
if (!USE_REAL_API) {
  setClock(() => MOCK_NOW);
}

export const services: Services = {
  auth: USE_REAL_API ? new HttpAuthService() : new MockAuthService(),
  ask: USE_REAL_API ? new HttpAskService() : new MockAskService(),
  billing: USE_REAL_API ? new HttpBillingService() : new MockBillingService(),
  drafts: USE_REAL_API ? new HttpDraftService() : new MockDraftService(),
  documents: USE_REAL_API ? new HttpDocumentService() : new MockDocumentService(),
  feedback: USE_REAL_API ? new HttpFeedbackService() : new MockFeedbackService(),
  organization: USE_REAL_API ? new HttpOrganizationService() : new MockOrganizationService(),
  integrations: USE_REAL_API ? new HttpIntegrationsService() : new MockIntegrationsService(),
  // No backend yet — these land with their roadmap phases.
  intelligence: new MockIntelligenceService(),
  tasks: new MockTaskService(),
  sources: new MockSourcesService(),
  calendar: new MockCalendarService(),
  meetings: new MockMeetingService(),
  inbox: new MockInboxService(),
  knowledge: new MockKnowledgeService(),
  projects: new MockProjectService(),
  search: new MockSearchService(),
  notifications: new MockNotificationService(),
};

export type { AuthService } from './auth/types';
export type { AskAnswer, AskCitation, AskService } from './ask/types';
export type { BillingService, CheckoutInput, CheckoutResult } from './billing/types';
export type { DocumentItem, DocumentList, DocumentService, DocumentUsage } from './documents/types';
export type { FeedbackInput, FeedbackReceipt, FeedbackService } from './feedback/types';
export type { Draft, DraftService, DraftStatus, DraftType } from './drafts/types';
export { DRAFT_TYPES, DRAFT_STATUSES } from './drafts/types';
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
