import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { services } from '@/services';
import { configureMockTransport } from '@/services/http/mock-transport';
import { expectNoA11yViolations } from '@/test/a11y';
import { renderWithProviders } from '@/test/render';
import { OnboardingConnectStep } from './onboarding-connect-step';

const CURATED_IDS = [
  'gmail', 'outlook', 'slack', 'microsoft_teams',
  'google_calendar', 'google_drive', 'notion',
  'github', 'jira', 'salesforce', 'hubspot',
];

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

    expect(
      await screen.findByRole('heading', { name: 'Communication', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Productivity', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Development', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Business', level: 2 })).toBeInTheDocument();

    // Curated means curated: a marketing tool from the full catalogue is absent.
    expect(screen.getByRole('heading', { name: /Gmail/ })).toBeInTheDocument();
    expect(screen.queryByText('Mailchimp')).not.toBeInTheDocument();
  });

  it('a fresh user can create the workspace, or skip', async () => {
    renderWithProviders(<OnboardingConnectStep />);
    await screen.findByRole('heading', { name: 'Communication', level: 2 });

    expect(screen.getByRole('button', { name: 'Create My Workspace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Skip and continue/ })).toBeInTheDocument();
  });

  it('connecting a tool runs the real permission-review flow and updates the count', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OnboardingConnectStep />);
    await screen.findByRole('heading', { name: 'Communication', level: 2 });

    // The same ConnectDialog the Connection Manager uses: review, then approve.
    // Gmail leads the Communication group, so the first Connect is Gmail's.
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
    await screen.findByRole('heading', { name: 'Communication', level: 2 });
    await expectNoA11yViolations(container);
  });
});
