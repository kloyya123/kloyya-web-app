import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { services } from '@/services';
import { configureMockTransport } from '@/services/http/mock-transport';
import { expectNoA11yViolations } from '@/test/a11y';
import { renderWithProviders } from '@/test/render';
import { OnboardingConnectStep } from './onboarding-connect-step';

const CURATED_IDS = ['gmail', 'google_calendar', 'google_drive', 'notion'];

/**
 * The Northwind mock pre-connects every curated tool (that story powers the
 * dashboard and trust center). This step, though, is a *brand-new user's*
 * moment — so these tests first put the store into the fresh-user state through
 * the service's own API. Vitest isolates modules per file, so the mutation
 * never reaches another suite.
 */
async function resetToFreshUser() {
  for (const id of CURATED_IDS) {
    // 409 (already disconnected) is fine — we only care about the end state.
    await services.integrations.disconnect(id).catch(() => undefined);
  }
}

beforeEach(async () => {
  configureMockTransport({ instant: true, failureRate: 0 });
  await resetToFreshUser();
});

describe('OnboardingConnectStep', () => {
  it('shows the curated groups, not the whole catalogue', async () => {
    renderWithProviders(<OnboardingConnectStep />);

    expect(await screen.findByRole('heading', { name: 'Email', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Calendar', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Documents', level: 2 })).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /Gmail/ })).toBeInTheDocument();
    // The private beta is seven tools; the long tail is post-beta and must not
    // appear as a card the user can click and get nothing from.
    expect(screen.queryByText('Slack')).not.toBeInTheDocument();
    expect(screen.queryByText('Salesforce')).not.toBeInTheDocument();
  });

  it('a fresh user can continue to personalization, or skip', async () => {
    renderWithProviders(<OnboardingConnectStep />);
    await screen.findByRole('heading', { name: 'Email', level: 2 });

    // Connecting tools comes before personalization now, so this step continues
    // rather than creating the workspace (that happens last).
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    // Skipping is always offered, not only when nothing has been connected.
    expect(screen.getByRole('button', { name: /Skip/ })).toBeInTheDocument();
  });

  it('connecting a tool runs the real permission-review flow and updates the count', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OnboardingConnectStep />);
    await screen.findByRole('heading', { name: 'Email', level: 2 });

    // The same ConnectDialog the Connection Manager uses: review, then approve.
    // Gmail leads the Email group, so the first Connect is Gmail's.
    const [connect] = screen.getAllByRole('button', { name: 'Connect' });
    await user.click(connect!);
    const approve = await screen.findByRole('button', { name: /Connect Gmail/ });
    await user.click(approve);

    // The dialog's success phase ends with Done; while it is open, Radix hides
    // the page behind it from the accessibility tree, so close it first. The
    // staged sync animation runs ~2.1s of real timers, hence the long timeout.
    await user.click(
      await screen.findByRole('button', { name: 'Done' }, { timeout: 6000 }),
    );

    await waitFor(() =>
      expect(screen.getByText(/1 tool connected/)).toBeInTheDocument(),
    );
    // With context on board, skipping stops making sense and disappears.
    expect(screen.queryByRole('button', { name: /Skip and continue/ })).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<OnboardingConnectStep />);
    await screen.findByRole('heading', { name: 'Email', level: 2 });
    await expectNoA11yViolations(container);
  });
});
