import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { configureMockTransport } from '@/services/http/mock-transport';
import { expectNoA11yViolations } from '@/test/a11y';
import { renderWithProviders } from '@/test/render';
import { RecommendationFeed } from './recommendation-feed';

beforeEach(() => {
  configureMockTransport({ instant: true, failureRate: 0 });
});

describe('RecommendationFeed', () => {
  it('leads with what still needs a decision', async () => {
    renderWithProviders(<RecommendationFeed />);
    expect(
      await screen.findByRole('heading', { name: 'Needs a decision', level: 2 }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Confirm a revised Atlas delivery date/)).toBeInTheDocument();
  });

  it('carries the reasoning and the cost of ignoring it, per the Golden Rules', async () => {
    renderWithProviders(<RecommendationFeed />);

    // A recommendation that cannot explain itself is not something this renders.
    await screen.findByText(/Confirm a revised Atlas delivery date/);
    expect(screen.getAllByText('If you act').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/If you don/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', { name: /Why is Kloyya suggesting this/ }).length,
    ).toBeGreaterThan(0);
  });

  it('moves a dismissed recommendation into "already decided"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecommendationFeed />);

    const active = await screen.findByRole('region', { name: 'Needs a decision' });
    const [dismiss] = within(active).getAllByRole('button', { name: 'Dismiss' });
    await user.click(dismiss!);

    // Optimistic: the decision is reflected without waiting for the round trip.
    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Already decided' }),
      ).toBeInTheDocument(),
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<RecommendationFeed />);
    await screen.findByRole('heading', { name: 'Needs a decision', level: 2 });
    await expectNoA11yViolations(container);
  });
});
