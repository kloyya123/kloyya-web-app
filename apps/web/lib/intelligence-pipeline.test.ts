import { describe, expect, it } from 'vitest';
import { PIPELINE_STAGES } from '@/types/sources';
import { advancePipeline, initialPipeline, isPipelineComplete } from './intelligence-pipeline';

describe('intelligence pipeline', () => {
  describe('initialPipeline', () => {
    it('starts with every stage present and the first one active', () => {
      const stages = initialPipeline();

      expect(stages).toHaveLength(PIPELINE_STAGES.length);
      expect(stages[0]?.status).toBe('active');
      expect(stages.slice(1).every((stage) => stage.status === 'pending')).toBe(true);
    });

    it('labels every stage in the interface voice', () => {
      const stages = initialPipeline();
      expect(stages.every((stage) => stage.label.length > 0)).toBe(true);
    });

    it('timestamps the active stage but not the pending ones', () => {
      const stages = initialPipeline();
      expect(stages[0]?.startedAt).toBeTypeOf('string');
      expect(stages[1]?.startedAt).toBeUndefined();
    });
  });

  describe('advancePipeline', () => {
    it('completes the active stage and activates the next', () => {
      const next = advancePipeline(initialPipeline());

      expect(next[0]?.status).toBe('complete');
      expect(next[0]?.completedAt).toBeTypeOf('string');
      expect(next[1]?.status).toBe('active');
    });

    it('walks through every stage in order and then completes', () => {
      let stages = initialPipeline();
      const activated: string[] = [stages[0]!.kind];

      for (let i = 0; i < PIPELINE_STAGES.length; i++) {
        stages = advancePipeline(stages);
        const active = stages.find((stage) => stage.status === 'active');
        if (active) activated.push(active.kind);
      }

      // Every stage was activated exactly once, in declared order.
      expect(activated).toEqual([...PIPELINE_STAGES]);
    });

    it('leaves a fully complete pipeline unchanged', () => {
      let stages = initialPipeline();
      for (let i = 0; i < PIPELINE_STAGES.length + 2; i++) {
        stages = advancePipeline(stages);
      }

      expect(stages.every((stage) => stage.status === 'complete')).toBe(true);
      // Advancing again is a no-op, not a crash.
      expect(advancePipeline(stages)).toEqual(stages);
    });
  });

  describe('isPipelineComplete', () => {
    it('is false until every stage is complete', () => {
      expect(isPipelineComplete(initialPipeline())).toBe(false);
    });

    it('is true once every stage is complete', () => {
      let stages = initialPipeline();
      for (let i = 0; i < PIPELINE_STAGES.length; i++) {
        stages = advancePipeline(stages);
      }
      expect(isPipelineComplete(stages)).toBe(true);
    });
  });
});
