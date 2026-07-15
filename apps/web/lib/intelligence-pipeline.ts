import {
  PIPELINE_STAGES,
  type PipelineStage,
  type PipelineStageKind,
} from '@/types/sources';

/**
 * The reasoning pipeline, as a pure state machine.
 *
 * The spec's Intelligence Timeline and Trusted Knowledge Search both want to
 * show reasoning "as a transparent workflow rather than a black box". Both drive
 * off this: a component advances the stages on a timer (mock) or on server
 * events (real), and renders whatever state it is handed. Keeping the machine
 * pure makes it trivially testable and swappable for a real event stream.
 */

/** Copy for each stage, in the interface's voice. Never "Executing step 3". */
const STAGE_LABELS: Record<PipelineStageKind, { label: string; detail: string }> = {
  intent: {
    label: 'Understanding your request',
    detail: 'Working out what you need before deciding where to look.',
  },
  retrieval: {
    label: 'Searching your approved sources',
    detail: 'Only sources you have connected and authorized are searched.',
  },
  context: {
    label: 'Building context',
    detail: 'Assembling the people, projects, and history this touches.',
  },
  relationships: {
    label: 'Finding relationships',
    detail: 'Connecting the evidence through the knowledge graph.',
  },
  decisions: {
    label: 'Checking previous decisions',
    detail: 'Comparing against how similar situations were handled before.',
  },
  ranking: {
    label: 'Ranking evidence',
    detail: 'Ordering by relevance, freshness, and source reliability.',
  },
  scoring: {
    label: 'Scoring confidence',
    detail: 'Trust takes priority over speed — low confidence is flagged, never hidden.',
  },
  generation: {
    label: 'Preparing your briefing',
    detail: 'Writing the recommendation, with its evidence attached.',
  },
};

/** A fresh pipeline: every stage present, the first one already running. */
export function initialPipeline(now: Date = new Date()): PipelineStage[] {
  return PIPELINE_STAGES.map((kind, index) => {
    const copy = STAGE_LABELS[kind];
    const stage: PipelineStage = {
      kind,
      label: copy.label,
      detail: copy.detail,
      status: index === 0 ? 'active' : 'pending',
    };
    if (index === 0) stage.startedAt = now.toISOString();
    return stage;
  });
}

/**
 * Complete the active stage and start the next one.
 *
 * A no-op once everything is complete, so a runaway timer cannot crash the view.
 */
export function advancePipeline(
  stages: PipelineStage[],
  now: Date = new Date(),
): PipelineStage[] {
  const activeIndex = stages.findIndex((stage) => stage.status === 'active');
  if (activeIndex === -1) return stages;

  return stages.map((stage, index) => {
    if (index === activeIndex) {
      return { ...stage, status: 'complete', completedAt: now.toISOString() };
    }
    if (index === activeIndex + 1) {
      return { ...stage, status: 'active', startedAt: now.toISOString() };
    }
    return stage;
  });
}

export function isPipelineComplete(stages: PipelineStage[]): boolean {
  return stages.every((stage) => stage.status === 'complete');
}
