import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '@/test/a11y';
import { Button } from './button';

describe('Button', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<Button>Save changes</Button>);
    await expectNoA11yViolations(container);
  });

  it('defaults to type="button" so it cannot accidentally submit a form', () => {
    render(<Button>Cancel</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('still allows an explicit submit type', () => {
    render(<Button type="submit">Sign in</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  describe('loading state', () => {
    it('announces the loading label and marks the control busy', () => {
      render(
        <Button isLoading loadingLabel="Signing in">
          Sign in
        </Button>,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toBeDisabled();
      // The visible label is hidden from AT; the loading label replaces it,
      // so the control is never a nameless spinner.
      expect(button).toHaveAccessibleName('Signing in');
    });

    it('cannot be activated while loading', async () => {
      const onClick = vi.fn();
      render(
        <Button isLoading onClick={onClick}>
          Sign in
        </Button>,
      );

      await userEvent.click(screen.getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('has no accessibility violations while loading', async () => {
      const { container } = render(
        <Button isLoading loadingLabel="Saving">
          Save
        </Button>,
      );
      await expectNoA11yViolations(container);
    });
  });

  it('is disabled and inert when isDisabled', async () => {
    const onClick = vi.fn();
    render(
      <Button isDisabled onClick={onClick}>
        Delete
      </Button>,
    );

    expect(screen.getByRole('button')).toBeDisabled();
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('fires onClick when enabled', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Publish</Button>);

    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders as a link when asChild, keeping button styling', () => {
    render(
      <Button asChild variant="link">
        <a href="/dashboard">Go to dashboard</a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: 'Go to dashboard' });
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('is reachable and activatable by keyboard', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Confirm</Button>);

    await userEvent.tab();
    expect(screen.getByRole('button')).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
  });
});
