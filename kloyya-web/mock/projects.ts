import type { ProjectHealth } from '@/types/domain';

/**
 * Per-project health analyses, keyed by project id.
 *
 * Only projects with something to explain carry one. Atlas is the worked example
 * of the whole demo — an external supplier slip dragging an otherwise sound
 * project into "at risk" — and the drivers say exactly that, positive and
 * negative, so the 54 is a reasoned number rather than a colour.
 */
export const mockProjectHealth: Record<string, ProjectHealth> = {
  proj_atlas: {
    projectId: 'proj_atlas',
    headline:
      'Execution is sound; an external supplier slip is what put Atlas at risk.',
    drivers: [
      {
        label: 'Supplier lead time',
        effect: 'negative',
        detail:
          'Actuator-housing lead time moved from 4 to 7 weeks, threatening the milestone-4 date Acme made a renewal condition.',
      },
      {
        label: 'Customer deadline',
        effect: 'negative',
        detail: 'Acme’s board reviews on 17 July; the revised date must be credible by then.',
      },
      {
        label: 'Progress to date',
        effect: 'positive',
        detail: '62% complete with non-housing work on track — the slip is external, not execution.',
      },
      {
        label: 'Mitigation in hand',
        effect: 'positive',
        detail: 'A rescope that protects the customer date is drafted and awaiting sign-off at the milestone review.',
      },
    ],
    confidence: 85,
  },
  proj_harbor: {
    projectId: 'proj_harbor',
    headline: 'Harbor is on track; only a small evidence backlog keeps it from full marks.',
    drivers: [
      {
        label: 'Audit readiness',
        effect: 'positive',
        detail: '88% complete with the SOC 2 control set implemented and mostly evidenced.',
      },
      {
        label: 'Outstanding evidence',
        effect: 'negative',
        detail: 'Three evidence artifacts remain outstanding ahead of the 22 July auditor deadline.',
      },
    ],
    confidence: 80,
  },
};
