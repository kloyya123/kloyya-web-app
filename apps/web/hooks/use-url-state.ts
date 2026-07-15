'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/**
 * A single filter value, held in the URL rather than in component state.
 *
 * KFA: "URL state — search, filters, sorting, pagination. The URL always
 * reflects navigation state." A filtered view you cannot send to a colleague, or
 * return to after a refresh, is a view the product forgot it was showing.
 *
 * The default value is never written to the query string — `/knowledge` and
 * `/knowledge?category=All` are the same view, and only one of them should exist.
 * `replace` rather than `push`, so flipping a filter does not fill the back
 * button with states the user never navigated to.
 */
export function useUrlState<T extends string>(
  key: string,
  defaultValue: T,
): [T, (next: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const value = (searchParams.get(key) as T | null) ?? defaultValue;

  const setValue = useCallback(
    (next: T) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, next);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [key, defaultValue, pathname, router, searchParams],
  );

  return [value, setValue];
}
