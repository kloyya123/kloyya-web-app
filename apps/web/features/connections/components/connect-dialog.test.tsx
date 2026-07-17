import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INTEGRATION_CATALOG } from '@/mock/integrations';
import { configureMockTransport } from '@/services/http/mock-transport';
import { expectNoA11yViolations } from '@/test/a11y';
import { renderWithProviders } from '@/test/render';
import type { IntegrationConnection } from '@/types/integrations';
import { ConnectDialog } from './connect-dialog';

configureMockTransport({ instant: true, failureRate: 0 });

const outlook = INTEGRATION_CATALOG.find((d) => d.id === 'outlook')!;
const available: IntegrationConnection = {
  definition: outlook,
  status: 'not_connected',
  lastSyncedAt: null,
};

function renderDialog() {
  return renderWithProviders(
    <ConnectDialog connection={available} isOpen onOpenChange={vi.fn()} />,
  );
}

describe('ConnectDialog', () => {
  beforeEach(() => {
    // The sync animation is timer-driven; drive it deterministically.
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('has no accessibility violations in the review phase', async () => {
    const { baseElement } = renderDialog();
    await expectNoA11yViolations(baseElement);
    vi.useRealTimers();
  });

  it('shows what Kloyya will and will not access before connecting', () => {
    // The spec makes this mandatory. Both lists must be visible in the review.
    renderDialog();

    // "Kloyya will" — granted scopes.
    for (const scope of outlook.permissions.granted) {
      expect(screen.getByText(scope)).toBeInTheDocument();
    }
    // "Kloyya will never" — withheld scopes.
    for (const scope of outlook.permissions.notGranted) {
      expect(screen.getByText(scope)).toBeInTheDocument();
    }
    vi.useRealTimers();
  });

  it('does not connect until the user confirms the permissions', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDialog();

    // The review is showing; the sync stages must not be.
    expect(screen.queryByText('Creating embeddings')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Connect Outlook/ }));

    // After confirming, the sync progress appears.
    await waitFor(() => {
      expect(screen.getByText('Reading structure')).toBeInTheDocument();
    });

    // And drives to completion.
    await vi.runAllTimersAsync();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('names the first-sync estimate so the wait is not a surprise', () => {
    renderDialog();
    expect(
      screen.getByText(new RegExp(`about ${outlook.estimatedSyncMinutes} minute`)),
    ).toBeInTheDocument();
    vi.useRealTimers();
  });
});
