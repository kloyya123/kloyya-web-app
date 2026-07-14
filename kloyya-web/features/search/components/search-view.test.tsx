import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureMockTransport } from '@/services/http/mock-transport';
import { expectNoA11yViolations } from '@/test/a11y';
import { renderWithProviders } from '@/test/render';
import { SearchView } from './search-view';

// next/navigation has no router in jsdom. The URL is the search view's source of
// truth, so the mock has to behave like one: replace() updates what the params
// report back, or the input/URL sync loop cannot be exercised at all.
const params = new URLSearchParams();
const replace = vi.fn((url: string) => {
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  const next = new URLSearchParams(query);
  params.delete('q');
  const q = next.get('q');
  if (q !== null) params.set('q', q);
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => params,
}));

beforeEach(() => {
  configureMockTransport({ instant: true, failureRate: 0 });
  params.delete('q');
  replace.mockClear();
});

describe('SearchView', () => {
  it('invites a query rather than showing an empty result list', () => {
    renderWithProviders(<SearchView />);
    expect(screen.getByText('Search across everything.')).toBeInTheDocument();
  });

  it('finds records across kinds and groups them', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchView />);

    await user.type(screen.getByRole('searchbox', { name: 'Search Kloyya' }), 'atlas');

    // "Atlas" spans a project, a meeting, tasks and a recommendation — several
    // groups appearing at once is the proof it crossed kinds.
    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Meetings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recommendations' })).toBeInTheDocument();

    // The meeting itself is reachable, by the link that opens it. Anchored,
    // because a recommendation's title also mentions the Atlas milestone review.
    expect(
      screen.getByRole('link', { name: /^Atlas milestone review/ }),
    ).toHaveAttribute('href', '/meetings/meet_atlas_review');
  });

  it('reflects the query into the URL, so a search is shareable', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchView />);

    await user.type(screen.getByRole('searchbox', { name: 'Search Kloyya' }), 'atlas');

    expect(replace).toHaveBeenCalled();
    expect(replace.mock.calls.at(-1)?.[0]).toBe('/search?q=atlas');
  });

  it('says so plainly when nothing matches', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchView />);

    await user.type(screen.getByRole('searchbox', { name: 'Search Kloyya' }), 'zzzznothing');
    expect(await screen.findByText(/Nothing matches/)).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<SearchView />);

    await user.type(screen.getByRole('searchbox', { name: 'Search Kloyya' }), 'atlas');
    await screen.findByRole('heading', { name: 'Projects' });

    await expectNoA11yViolations(container);
  });
});
