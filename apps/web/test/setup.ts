import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';
import { afterEach, expect, vi } from 'vitest';

expect.extend(toHaveNoViolations);

/**
 * A working in-memory router.
 *
 * Filters live in the URL (useUrlState), so a component that switches a tab or a
 * filter writes to the router and re-reads it. A no-op router mock would leave
 * those components frozen on their default view and quietly turn every filter
 * test green without testing anything. This one actually stores the query and
 * notifies subscribers, so `replace()` re-renders exactly as it does in the app.
 */
let testSearch = '';
const searchListeners = new Set<() => void>();

function navigate(url: string): void {
  const index = url.indexOf('?');
  testSearch = index === -1 ? '' : url.slice(index + 1);
  for (const listener of searchListeners) listener();
}

vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');

  return {
    useRouter: () => ({
      push: navigate,
      replace: navigate,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    }),
    usePathname: () => '/',
    useSearchParams: () =>
      new URLSearchParams(
        useSyncExternalStore(
          (onChange: () => void) => {
            searchListeners.add(onChange);
            return () => searchListeners.delete(onChange);
          },
          () => testSearch,
          () => testSearch,
        ),
      ),
  };
});

afterEach(() => {
  cleanup();
  // Each test starts at a clean URL, or one test's filter leaks into the next.
  testSearch = '';
  searchListeners.clear();
});

/**
 * jsdom implements neither of these, and both are load-bearing for us:
 * `matchMedia` backs next-themes and our reduced-motion handling; `ResizeObserver`
 * backs Radix popovers and Recharts. Without them, component tests fail on mount
 * for reasons unrelated to the component under test.
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
window.ResizeObserver = ResizeObserverStub;

if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
}
