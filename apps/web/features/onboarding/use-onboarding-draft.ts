'use client';

import { useCallback, useRef } from 'react';
import type { OnboardingValues } from './schemas';

const STORAGE_KEY = 'kloyya_onboarding_draft';

/**
 * Persist onboarding answers across a reload.
 *
 * Onboarding is the one flow a user cannot skip, and losing four screens of
 * answers to an accidental refresh is the kind of thing that makes someone
 * close the tab. sessionStorage rather than localStorage: the draft should not
 * outlive the tab, and it must never linger on a shared machine.
 *
 * Read once, synchronously, on first call. Reading on every render would fight
 * React Hook Form for ownership of the values.
 */
export function useOnboardingDraft() {
  const initial = useRef<Partial<OnboardingValues> | null>(null);

  if (initial.current === null) {
    initial.current = readDraft();
  }

  const saveDraft = useCallback((values: Partial<OnboardingValues>) => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    } catch {
      // Private mode, or a full quota. A lost draft is a worse experience,
      // not a broken one — never let it take down the flow.
    }
  }, []);

  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to do, and nothing worth telling the user.
    }
  }, []);

  return { draft: initial.current, saveDraft, clearDraft };
}

function readDraft(): Partial<OnboardingValues> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    // A hand-edited draft must not crash the wizard. It is re-validated by Zod
    // on every step anyway, so a bad shape simply fails validation.
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Partial<OnboardingValues>)
      : {};
  } catch {
    return {};
  }
}
