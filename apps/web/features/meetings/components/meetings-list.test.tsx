import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { configureMockTransport } from '@/services/http/mock-transport';
import { expectNoA11yViolations } from '@/test/a11y';
import { renderWithProviders } from '@/test/render';
import { MeetingsList } from './meetings-list';

beforeEach(() => {
  configureMockTransport({ instant: true, failureRate: 0 });
});

describe('MeetingsList', () => {
  it('splits what is coming from what already happened', async () => {
    renderWithProviders(<MeetingsList />);

    expect(await screen.findByRole('heading', { name: 'Coming up', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Past', level: 2 })).toBeInTheDocument();
    expect(await screen.findByText(/Atlas milestone review/)).toBeInTheDocument();
  });

  it('links each meeting to its own page', async () => {
    renderWithProviders(<MeetingsList />);
    const link = await screen.findByRole('link', { name: /Atlas milestone review/ });
    expect(link).toHaveAttribute('href', '/meetings/meet_atlas_review');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<MeetingsList />);
    await screen.findByRole('heading', { name: 'Coming up', level: 2 });
    await expectNoA11yViolations(container);
  });
});
