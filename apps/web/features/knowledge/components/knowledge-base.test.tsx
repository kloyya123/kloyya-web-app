import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { configureMockTransport } from '@/services/http/mock-transport';
import { expectNoA11yViolations } from '@/test/a11y';
import { renderWithProviders } from '@/test/render';
import { KnowledgeBase } from './knowledge-base';

beforeEach(() => {
  configureMockTransport({ instant: true, failureRate: 0 });
});

describe('KnowledgeBase', () => {
  it('lists articles with their category and confidence', async () => {
    renderWithProviders(<KnowledgeBase />);
    expect(await screen.findByText(/Atlas milestone-4 rescope decision/)).toBeInTheDocument();
  });

  it('filters by category without erasing the other choices', async () => {
    const user = userEvent.setup();
    renderWithProviders(<KnowledgeBase />);

    // A playbook is on screen before the filter narrows things down.
    expect(await screen.findByText(/Supplier delay response playbook/)).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Decisions' }));

    // The filter round-trips through the URL and actually narrows the list...
    await waitFor(() =>
      expect(screen.queryByText(/Supplier delay response playbook/)).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/Atlas milestone-4 rescope decision/)).toBeInTheDocument();

    // ...without the control collapsing to just the category you picked.
    expect(screen.getByRole('button', { name: 'Playbooks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
  });

  it('offers the graph as an accessible panel, not only a picture', async () => {
    const user = userEvent.setup();
    renderWithProviders(<KnowledgeBase />);

    await user.click(screen.getByRole('tab', { name: 'Graph' }));

    // The SVG is decorative; the focus selector and connections panel are the
    // accessible equivalent, and a keyboard user reaches every node through them.
    expect(await screen.findByRole('combobox', { name: 'Focus node' })).toBeInTheDocument();

    // Every connection is a real, focusable control — not just a line on a picture.
    const refocusButtons = await screen.findAllByRole('button', { name: /^Focus / });
    expect(refocusButtons.length).toBeGreaterThan(0);
  });

  it('has no accessibility violations (articles)', async () => {
    const { container } = renderWithProviders(<KnowledgeBase />);
    await screen.findByText(/Atlas milestone-4 rescope decision/);
    await expectNoA11yViolations(container);
  });

  it('has no accessibility violations (graph)', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<KnowledgeBase />);

    await user.click(screen.getByRole('tab', { name: 'Graph' }));
    await screen.findByRole('combobox', { name: 'Focus node' });

    await expectNoA11yViolations(container);
  });
});
