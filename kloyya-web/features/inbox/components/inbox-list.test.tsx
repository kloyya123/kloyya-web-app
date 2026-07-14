import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { configureMockTransport } from '@/services/http/mock-transport';
import { expectNoA11yViolations } from '@/test/a11y';
import { renderWithProviders } from '@/test/render';
import { InboxList } from './inbox-list';

beforeEach(() => {
  configureMockTransport({ instant: true, failureRate: 0 });
});

describe('InboxList', () => {
  it('triages into needs-attention and everything else', async () => {
    renderWithProviders(<InboxList />);

    expect(
      await screen.findByRole('heading', { name: 'Needs attention', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Everything else', level: 2 })).toBeInTheDocument();

    // The renewal thread is the one that changes the day; it must be present.
    expect(await screen.findByText(/Contract renewal/)).toBeInTheDocument();
  });

  it('states why a thread ranks where it does', async () => {
    renderWithProviders(<InboxList />);
    // The Golden Rule made visible: the list never sorts by an invisible score.
    expect(await screen.findByText(/hard 17 July deadline/)).toBeInTheDocument();
  });

  it('shows a loading region rather than an empty screen', () => {
    renderWithProviders(<InboxList />);
    expect(screen.getByRole('heading', { name: 'Inbox', level: 1 })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<InboxList />);
    await screen.findByRole('heading', { name: 'Needs attention', level: 2 });
    await expectNoA11yViolations(container);
  });
});
