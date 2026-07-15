import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { configureMockTransport } from '@/services/http/mock-transport';
import { expectNoA11yViolations } from '@/test/a11y';
import { renderWithProviders } from '@/test/render';
import { ProjectsBoard } from './projects-board';

beforeEach(() => {
  configureMockTransport({ instant: true, failureRate: 0 });
});

describe('ProjectsBoard', () => {
  it('leads with the project that needs attention', async () => {
    renderWithProviders(<ProjectsBoard />);

    const links = await screen.findAllByRole('link');
    // Worst health first: Atlas (54) must outrank Meridian (82) and Harbor (91).
    expect(links[0]).toHaveAttribute('href', '/projects/proj_atlas');
  });

  it('states the health band in words, not only colour', async () => {
    renderWithProviders(<ProjectsBoard />);
    // WCAG 1.4.1: meaning never rides on hue alone.
    expect(await screen.findByText(/At risk/)).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<ProjectsBoard />);
    await screen.findAllByRole('link');
    await expectNoA11yViolations(container);
  });
});
