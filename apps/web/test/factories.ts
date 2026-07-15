import { priorityFromDecisionScore } from '@/lib/decision-score';
import type { Evidence, ReasoningStep, Recommendation } from '@/types/domain';

/**
 * Test fixtures.
 *
 * Deliberately built through the same derivation the app uses — `priority` comes
 * from `priorityFromDecisionScore`, never hand-written — so a test cannot
 * construct a recommendation the production code could not produce.
 */

let counter = 0;
const nextId = (prefix: string) => `${prefix}_${++counter}`;

export function makeEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: nextId('ev'),
    sourceType: 'email',
    sourceLabel: 'Gmail — Marcus Webb',
    excerpt: 'We cannot proceed with renewal until we have a confirmed date.',
    timestamp: '2026-07-09T13:00:00.000Z',
    ownerId: 'user_amara',
    reliability: 96,
    freshness: 98,
    classification: 'internal',
    ...overrides,
  };
}

export function makeReasoningStep(overrides: Partial<ReasoningStep> = {}): ReasoningStep {
  return {
    id: nextId('step'),
    statement: 'Acme stated renewal depends on a confirmed delivery date.',
    evidenceIds: [],
    ...overrides,
  };
}

export function makeRecommendation(
  overrides: Partial<Recommendation> = {},
): Recommendation {
  const evidence = overrides.evidence ?? [makeEvidence()];
  const decisionScore = overrides.decisionScore ?? 96;

  return {
    id: nextId('rec'),
    organizationId: 'org_test',
    workspaceId: 'ws_test',
    createdBy: 'agent',
    updatedBy: 'agent',
    createdAt: '2026-07-10T07:00:00.000Z',
    updatedAt: '2026-07-10T07:00:00.000Z',
    version: 1,

    title: 'Confirm a revised delivery date with Acme',
    reason: 'Acme has made renewal conditional on a confirmed date.',
    confidence: 94,
    decisionScore,
    priority: priorityFromDecisionScore(decisionScore),
    risk: 'Critical',

    evidence,
    reasoning: [makeReasoningStep({ evidenceIds: [evidence[0].id] })],
    assumptions: ['Acme has not begun a competitive procurement process.'],
    conflicts: [],

    suggestedAction: { label: 'Draft the revised timeline', isDestructive: false },
    expectedOutcome: 'Acme receives a credible date before their board meets.',
    whatHappensIfIgnored: 'The contract lapses into the auto-renewal window.',
    confirmationRequired: false,

    generatedByAgent: 'risk',
    deliveryChannels: ['dashboard'],
    outcome: 'pending',
    ...overrides,
  };
}
