import { axe } from 'jest-axe';
import { expect } from 'vitest';

/**
 * Assert a rendered subtree has no detectable WCAG violations.
 *
 * The specs set WCAG 2.2 AA as the target and call accessibility "mandatory",
 * so this belongs in the default test for a component — not in a separate
 * a11y suite that gets skipped when it goes red.
 *
 * Automated checks catch roughly a third of real issues. They do not replace
 * the keyboard-only and screen-reader passes in the phase checklist.
 */
export async function expectNoA11yViolations(container: Element): Promise<void> {
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}
