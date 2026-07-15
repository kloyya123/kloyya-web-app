import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider } from '@/providers/auth-provider';
import { DEFAULT_PREFERENCES, type Session } from '@/services/auth/types';
import { configureMockTransport } from '@/services/http/mock-transport';
import { mockOrganization, mockUser, mockWorkspace } from '@/mock/organization';
import { writeSession } from '@/services/auth/session-store';
import { expectNoA11yViolations } from '@/test/a11y';
import { renderWithProviders } from '@/test/render';
import { SettingsView } from './settings-view';

const session: Session = {
  user: mockUser,
  organization: mockOrganization,
  workspace: mockWorkspace,
  preferences: DEFAULT_PREFERENCES,
  accessToken: 'mock_at_test',
  expiresAt: new Date(Date.now() + 8 * 3_600_000).toISOString(),
};

function renderSettings() {
  // updateSettings reads the cookie, so the session has to exist there too.
  writeSession(session);
  return renderWithProviders(
    <AuthProvider initialSession={session}>
      <SettingsView />
    </AuthProvider>,
  );
}

beforeEach(() => {
  configureMockTransport({ instant: true, failureRate: 0 });
});

describe('SettingsView', () => {
  it('opens with the values the session already holds', () => {
    renderSettings();
    expect(screen.getByLabelText('Full name')).toHaveValue(mockUser.fullName);
    expect(screen.getByLabelText('Company')).toHaveValue(mockOrganization.name);
  });

  it('cannot be saved until something actually changes', async () => {
    const user = userEvent.setup();
    renderSettings();

    // A live Save button that does nothing is a lie about state.
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();

    await user.type(screen.getByLabelText('Role'), ' of Staff');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled(),
    );
  });

  it('saves, then settles back to a clean form', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.clear(screen.getByLabelText('Full name'));
    await user.type(screen.getByLabelText('Full name'), 'Amara O.');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Saved')).toBeInTheDocument();
    // Re-baselined: nothing left to save.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled(),
    );
  });

  it('refuses an empty name, helpfully', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.clear(screen.getByLabelText('Full name'));
    await user.tab();

    expect(await screen.findByText('Enter your name.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderSettings();
    await expectNoA11yViolations(container);
  });
});
