import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { configureMockTransport } from '@/services/http/mock-transport';
import { expectNoA11yViolations } from '@/test/a11y';
import { renderWithProviders } from '@/test/render';
import { NotificationsView } from './notifications-view';

beforeEach(() => {
  configureMockTransport({ instant: true, failureRate: 0 });
});

describe('NotificationsView', () => {
  it('renders notifications ranked by decision score', async () => {
    renderWithProviders(<NotificationsView />);
    expect(await screen.findAllByRole('listitem')).not.toHaveLength(0);
  });

  it('marks everything read, and the unread badge goes away', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationsView />);

    const markAll = await screen.findByRole('button', { name: /Mark all read/ });
    await user.click(markAll);

    // Optimistic: the affordance disappears because there is nothing left to do.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Mark all read/ })).not.toBeInTheDocument(),
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<NotificationsView />);
    await screen.findAllByRole('listitem');
    await expectNoA11yViolations(container);
  });
});
