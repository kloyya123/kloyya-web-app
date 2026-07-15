import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { configureMockTransport } from '@/services/http/mock-transport';
import { renderWithProviders } from '@/test/render';
import { TrustedSearchIndicator } from './trusted-search-indicator';

configureMockTransport({ instant: true, failureRate: 0 });

// A tiny step interval with real timers, rather than fake timers — which tangle
// with TanStack Query's promise-based scheduling.
const fast = <TrustedSearchIndicator stepMs={2} />;

describe('TrustedSearchIndicator', () => {
  it('names its region for assistive tech', () => {
    renderWithProviders(fast);
    expect(screen.getByRole('region', { name: 'Intelligence status' })).toBeInTheDocument();
  });

  it('has a polite live region so the status is announced, not the ticks', () => {
    renderWithProviders(fast);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('lists only the working sources it is searching', async () => {
    renderWithProviders(fast);

    // Gmail is healthy → searched. Salesforce is token-expired → never searched.
    await waitFor(() => expect(screen.getByText('Gmail')).toBeInTheDocument());
    expect(screen.queryByText('Salesforce')).not.toBeInTheDocument();
  });

  it('advances the reasoning and settles into an honest summary', async () => {
    renderWithProviders(fast);

    // "Never fake activity": once complete it settles into grounded-in-N-of-M,
    // and stops showing marching steps.
    await waitFor(
      () =>
        expect(
          screen.getByText(/Grounded in \d+ of \d+ connected sources/),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });
});
