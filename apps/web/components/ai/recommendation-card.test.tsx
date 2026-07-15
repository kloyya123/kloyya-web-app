import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { configureMockTransport } from '@/services/http/mock-transport';
import { expectNoA11yViolations } from '@/test/a11y';
import { makeEvidence, makeRecommendation, makeReasoningStep } from '@/test/factories';
import { renderWithProviders } from '@/test/render';
import { RecommendationCard } from './recommendation-card';

// The expanded card fetches its retrieval breakdown. For factory-made ids that
// do not exist in the mock org, that resolves to a 404 the panel swallows —
// which is exactly the graceful degradation these tests want to allow.
configureMockTransport({ instant: true, failureRate: 0 });

/**
 * These are the DCTF Golden Rules, checked as rendered behaviour:
 *
 *   "Never recommend without evidence."   -> the evidence is reachable
 *   "Never hide uncertainty."             -> the confidence is always visible
 *   "Always explain why."                 -> the reasoning is reachable
 *   "Never ignore conflicting data."      -> conflicts are surfaced first
 *   "Never automate destructive actions
 *    without user approval."              -> confirmation gate
 *
 * The type system already makes an evidence-free recommendation unconstructible.
 * These tests cover the half the type system cannot: that what exists is shown.
 */
function renderCard(props: Partial<Parameters<typeof RecommendationCard>[0]> = {}) {
  const recommendation = props.recommendation ?? makeRecommendation();
  return renderWithProviders(
    <RecommendationCard {...props} recommendation={recommendation} />,
  );
}

describe('RecommendationCard', () => {
  it('has no accessibility violations', async () => {
    const { container } = renderCard();
    await expectNoA11yViolations(container);
  });

  it('always shows the confidence, never a bare title', () => {
    renderCard({ recommendation: makeRecommendation({ confidence: 94 }) });
    expect(screen.getByText('94% confident')).toBeInTheDocument();
  });

  it('states both what happens if you act and if you do not', () => {
    // Principle 16: a recommendation that names no consequence is not actionable.
    renderCard();
    expect(screen.getByText(/Acme receives a credible date/)).toBeInTheDocument();
    expect(screen.getByText(/lapses into the auto-renewal window/)).toBeInTheDocument();
  });

  it('shows priority and risk as text, not only as colour', () => {
    // WCAG 1.4.1: hue alone must never carry meaning.
    renderCard();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Critical risk')).toBeInTheDocument();
  });

  describe('evidence and reasoning', () => {
    it('keeps them behind a disclosure by default', () => {
      renderCard();
      expect(screen.queryByText(/How Kloyya reached this/)).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Why is Kloyya suggesting this\?/ }),
      ).toBeInTheDocument();
    });

    it('reveals the reasoning and the evidence excerpt on expand', async () => {
      renderCard();
      await userEvent.click(
        screen.getByRole('button', { name: /Why is Kloyya suggesting this\?/ }),
      );

      expect(screen.getByText(/How Kloyya reached this/)).toBeInTheDocument();
      expect(
        screen.getByText(/We cannot proceed with renewal until we have a confirmed date/),
      ).toBeInTheDocument();
      expect(screen.getByText('Based on one source.')).toBeInTheDocument();
    });

    it('opens expanded when asked, for the single most important item', () => {
      renderCard({ defaultExpanded: true });
      expect(screen.getByText(/How Kloyya reached this/)).toBeInTheDocument();
    });

    it('marks a reasoning step with no evidence as an inference, not a fact', async () => {
      renderCard({
        recommendation: makeRecommendation({
          reasoning: [makeReasoningStep({ evidenceIds: [] })],
        }),
      });
      await userEvent.click(
        screen.getByRole('button', { name: /Why is Kloyya suggesting this\?/ }),
      );

      expect(
        screen.getByText(/Inferred from the steps above, not from a source/),
      ).toBeInTheDocument();
    });

    it('surfaces a conflict above the reasoning', async () => {
      const evidence = [makeEvidence(), makeEvidence()] as const;
      renderCard({
        recommendation: makeRecommendation({
          evidence: [evidence[0], evidence[1]],
          conflicts: [
            {
              id: 'conflict_1',
              summary: 'Two sources give different deadlines.',
              conflictingEvidenceIds: [evidence[0].id, evidence[1].id],
              recommendedResolution: 'Trust the newer source, then confirm with Legal.',
            },
          ],
        }),
      });

      await userEvent.click(
        screen.getByRole('button', { name: /Why is Kloyya suggesting this\?/ }),
      );

      expect(screen.getByText('Conflicting information detected')).toBeInTheDocument();
      expect(screen.getByText(/Trust the newer source/)).toBeInTheDocument();
    });
  });

  describe('outcomes', () => {
    it('lets the user dismiss or postpone — AI never decides for them', async () => {
      const onOutcome = vi.fn();
      const recommendation = makeRecommendation();
      renderCard({ recommendation, onOutcome });

      await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(onOutcome).toHaveBeenCalledWith(recommendation.id, 'dismissed');

      await userEvent.click(screen.getByRole('button', { name: 'Later' }));
      expect(onOutcome).toHaveBeenCalledWith(recommendation.id, 'postponed');
    });

    it('reports a resolved recommendation and hides its actions', () => {
      renderCard({ recommendation: makeRecommendation({ outcome: 'dismissed' }) });

      expect(screen.getByRole('status')).toHaveTextContent('You dismissed this.');
      expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    });
  });

  describe('confirmation gate', () => {
    it('interposes a confirmation when the recommendation requires one', async () => {
      const onOutcome = vi.fn();
      const recommendation = makeRecommendation({
        confirmationRequired: true,
        suggestedAction: { label: 'Rescope milestone 4', isDestructive: false },
      });
      renderCard({ recommendation, onOutcome });

      await userEvent.click(screen.getByRole('button', { name: 'Rescope milestone 4' }));

      // Not yet accepted — the user must confirm first.
      expect(onOutcome).not.toHaveBeenCalled();
      const group = screen.getByRole('group', { name: 'Confirm this action' });
      expect(within(group).getByText('Confirm before Kloyya acts.')).toBeInTheDocument();

      await userEvent.click(within(group).getByRole('button', { name: 'Rescope milestone 4' }));
      expect(onOutcome).toHaveBeenCalledWith(recommendation.id, 'accepted');
    });

    it('warns that a destructive action cannot be undone', async () => {
      renderCard({
        recommendation: makeRecommendation({
          suggestedAction: { label: 'Archive the project', isDestructive: true },
        }),
      });

      await userEvent.click(screen.getByRole('button', { name: 'Archive the project' }));
      expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    });

    it('lets the user back out of a confirmation', async () => {
      const onOutcome = vi.fn();
      renderCard({
        recommendation: makeRecommendation({
          confirmationRequired: true,
          suggestedAction: { label: 'Rescope milestone 4', isDestructive: false },
        }),
        onOutcome,
      });

      await userEvent.click(screen.getByRole('button', { name: 'Rescope milestone 4' }));
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onOutcome).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Later' })).toBeInTheDocument();
    });

    it('does not gate an ordinary action', async () => {
      const onOutcome = vi.fn();
      const recommendation = makeRecommendation({
        confirmationRequired: false,
        suggestedAction: { label: 'Open the review', isDestructive: false },
      });
      renderCard({ recommendation, onOutcome });

      await userEvent.click(screen.getByRole('button', { name: 'Open the review' }));
      expect(onOutcome).toHaveBeenCalledWith(recommendation.id, 'accepted');
    });
  });

  describe('feedback', () => {
    it('records a quality rating separately from the outcome', async () => {
      const onRate = vi.fn();
      const onOutcome = vi.fn();
      const recommendation = makeRecommendation();
      renderCard({ recommendation, onRate, onOutcome });

      await userEvent.click(screen.getByRole('button', { name: 'Yes, this was useful' }));

      expect(onRate).toHaveBeenCalledWith(recommendation.id, 'helpful');
      // Rating is not an outcome. A helpful recommendation may still be dismissed.
      expect(onOutcome).not.toHaveBeenCalled();
    });
  });
});
