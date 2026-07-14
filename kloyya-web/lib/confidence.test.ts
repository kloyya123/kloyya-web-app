import { describe, expect, it } from 'vitest';
import {
  AUTOMATION_THRESHOLD,
  presentConfidence,
  REVIEW_THRESHOLD,
  type ConfidenceBand,
} from './confidence';

describe('presentConfidence', () => {
  it.each<[number, ConfidenceBand]>([
    [100, 'high'],
    [90, 'high'],
    [89, 'moderate'],
    [75, 'moderate'],
    [74, 'limited'],
    [60, 'limited'],
    [59, 'low'],
    [0, 'low'],
  ])('bands %i as %s', (score, band) => {
    expect(presentConfidence(score).band).toBe(band);
  });

  it('rounds the label but preserves the underlying score', () => {
    const result = presentConfidence(94.6);
    expect(result.label).toBe('95% confident');
    expect(result.score).toBe(94.6);
  });

  it('always carries an explanation, never a bare percentage', () => {
    // DCTF Golden Rule: "Never hide uncertainty."
    for (const score of [0, 30, 65, 80, 99]) {
      expect(presentConfidence(score).explanation.length).toBeGreaterThan(0);
    }
  });

  describe('requiresReview', () => {
    it('is true strictly below the review threshold', () => {
      expect(presentConfidence(REVIEW_THRESHOLD - 0.1).requiresReview).toBe(true);
      expect(presentConfidence(REVIEW_THRESHOLD).requiresReview).toBe(false);
    });

    it('caveats low confidence rather than hiding it', () => {
      const low = presentConfidence(35);
      expect(low.requiresReview).toBe(true);
      expect(low.explanation).toMatch(/review|verif/i);
    });
  });

  describe('permitsAutomation', () => {
    it('is true only at or above the automation threshold', () => {
      // Automation Engine: "Only high-confidence automations should execute
      // automatically. Others require approval."
      expect(presentConfidence(AUTOMATION_THRESHOLD).permitsAutomation).toBe(true);
      expect(presentConfidence(AUTOMATION_THRESHOLD - 0.1).permitsAutomation).toBe(
        false,
      );
    });

    it('never permits automation for anything requiring review', () => {
      for (let score = 0; score <= 100; score += 0.5) {
        const c = presentConfidence(score);
        expect(c.requiresReview && c.permitsAutomation).toBe(false);
      }
    });
  });

  it('clamps out-of-range input', () => {
    expect(presentConfidence(-20).score).toBe(0);
    expect(presentConfidence(140).score).toBe(100);
    expect(presentConfidence(Number.NaN).band).toBe('low');
  });
});
