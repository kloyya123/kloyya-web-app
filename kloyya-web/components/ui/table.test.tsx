import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '@/test/a11y';
import { SortableHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

function renderTable(props: Partial<Parameters<typeof SortableHeader>[0]> = {}) {
  const onSort = props.onSort ?? vi.fn();

  const utils = render(
    <Table caption="Tasks in this workspace">
      <TableHeader>
        <TableRow>
          <SortableHeader
            columnId="title"
            label="Task"
            sortBy={props.sortBy ?? 'title'}
            sortDirection={props.sortDirection ?? 'asc'}
            onSort={onSort}
          />
          <SortableHeader
            columnId="dueAt"
            label="Due"
            sortBy={props.sortBy ?? 'title'}
            sortDirection={props.sortDirection ?? 'asc'}
            onSort={onSort}
          />
          <TableHead>Owner</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Send revised timeline</TableCell>
          <TableCell>In 2 days</TableCell>
          <TableCell>Amara Osei</TableCell>
        </TableRow>
      </TableBody>
    </Table>,
  );

  return { ...utils, onSort };
}

describe('Table', () => {
  it('has no accessibility violations', async () => {
    const { container } = renderTable();
    await expectNoA11yViolations(container);
  });

  it('renders a real table with an accessible name', () => {
    renderTable();
    expect(screen.getByRole('table', { name: 'Tasks in this workspace' })).toBeInTheDocument();
  });

  it('exposes rows and cells to assistive tech', () => {
    renderTable();
    expect(screen.getAllByRole('columnheader')).toHaveLength(3);
    expect(screen.getByRole('cell', { name: 'Send revised timeline' })).toBeInTheDocument();
  });
});

describe('SortableHeader', () => {
  it('marks only the active column with aria-sort', () => {
    renderTable({ sortBy: 'title', sortDirection: 'asc' });

    const [taskHeader, dueHeader] = screen.getAllByRole('columnheader');
    expect(taskHeader).toHaveAttribute('aria-sort', 'ascending');
    // WAI-ARIA: at most one column may claim a sort at a time.
    expect(dueHeader).not.toHaveAttribute('aria-sort');
  });

  it('reports a descending sort', () => {
    renderTable({ sortBy: 'title', sortDirection: 'desc' });
    expect(screen.getAllByRole('columnheader')[0]).toHaveAttribute('aria-sort', 'descending');
  });

  it('puts the sort control in a button, not on the cell', () => {
    // A click handler on a <th> is unreachable by keyboard and announces nothing.
    renderTable();
    expect(screen.getByRole('button', { name: /Task/ })).toBeInTheDocument();
  });

  it('toggles direction when the active column is clicked again', async () => {
    const { onSort } = renderTable({ sortBy: 'title', sortDirection: 'asc' });

    await userEvent.click(screen.getByRole('button', { name: /Task/ }));
    expect(onSort).toHaveBeenCalledWith('title', 'desc');
  });

  it('starts a newly chosen column ascending', async () => {
    const { onSort } = renderTable({ sortBy: 'title', sortDirection: 'desc' });

    await userEvent.click(screen.getByRole('button', { name: /Due/ }));
    expect(onSort).toHaveBeenCalledWith('dueAt', 'asc');
  });

  it('is operable by keyboard', async () => {
    const { onSort } = renderTable({ sortBy: 'title', sortDirection: 'asc' });

    await userEvent.tab();
    expect(screen.getByRole('button', { name: /Task/ })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onSort).toHaveBeenCalledWith('title', 'desc');
  });

  it('names the action, so the button is not just a column label', () => {
    renderTable({ sortBy: 'title', sortDirection: 'asc' });
    expect(
      screen.getByRole('button', { name: 'Task, sorted ascending. Sort descending.' }),
    ).toBeInTheDocument();
  });
});
