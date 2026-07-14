import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { configureMockTransport } from '@/services/http/mock-transport';
import { expectNoA11yViolations } from '@/test/a11y';
import { renderWithProviders } from '@/test/render';
import { OrganizationOverview } from './organization-overview';

beforeEach(() => {
  configureMockTransport({ instant: true, failureRate: 0 });
});

describe('OrganizationOverview', () => {
  it('keeps its heading visible while the data loads', () => {
    renderWithProviders(<OrganizationOverview />);
    // The header must not vanish into the loading branch — it did once.
    expect(screen.getByRole('heading', { name: 'Organization', level: 1 })).toBeInTheDocument();
  });

  it('lists people most senior first', async () => {
    renderWithProviders(<OrganizationOverview />);

    expect(await screen.findByText('Amara Osei')).toBeInTheDocument();
    const people = await screen.findAllByRole('link');
    // Amara is the executive; the managers follow.
    expect(people[0]).toHaveAttribute('href', '/organization/user_amara');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<OrganizationOverview />);
    await screen.findByText('Amara Osei');
    await expectNoA11yViolations(container);
  });
});
