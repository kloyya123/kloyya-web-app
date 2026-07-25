import { screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InboxList } from '@/features/inbox/components/inbox-list';
import { MeetingsList } from '@/features/meetings/components/meetings-list';
import { NotificationsView } from '@/features/notifications/components/notifications-view';
import { RecommendationFeed } from '@/features/recommendations/components/recommendation-feed';
import { configureMockTransport } from '@/services/http/mock-transport';
import { expectNoA11yViolations } from '@/test/a11y';
import { renderWithProviders } from '@/test/render';

/**
 * Failure injection, as a test rather than a promise.
 *
 * The mock transport exists to make loading and error states *real*. A mock that
 * never fails lets you ship a screen whose error path has never once run — and
 * that path then debuts on the day the backend has its first bad afternoon.
 *
 * Every screen below is driven with the transport failing 100% of the time. Each
 * must show a real, announced, recoverable error — not a blank page, not a
 * skeleton that spins forever, and not a crash.
 */
const SCREENS: [name: string, ui: ReactElement][] = [
  ['Inbox', <InboxList key="inbox" />],
  ['Meetings', <MeetingsList key="meetings" />],
  ['Recommendations', <RecommendationFeed key="recs" />],
  ['Notifications', <NotificationsView key="notifications" />],
];

beforeEach(() => {
  configureMockTransport({ instant: true, failureRate: 1 });
});

afterEach(() => {
  // Leave the transport healthy, or every later test inherits the failure.
  configureMockTransport({ instant: true, failureRate: 0 });
});

describe.each(SCREENS)('%s, when the service is down', (name, ui) => {
  it('announces the failure rather than showing a blank page', async () => {
    renderWithProviders(ui);

    // role="alert" — a screen reader is told, not left to discover it.
    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
  });

  it('offers a way back, because a 503 is worth retrying', async () => {
    renderWithProviders(ui);

    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('keeps its page heading, so the user knows what failed', async () => {
    renderWithProviders(ui);

    await screen.findByRole('alert');
    // The header must survive the error branch — "something failed" is useless
    // if you cannot tell *which* screen you are on.
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('has no accessibility violations in its error state', async () => {
    const { container } = renderWithProviders(ui);

    await screen.findByRole('alert');
    await expectNoA11yViolations(container);
  });
});
