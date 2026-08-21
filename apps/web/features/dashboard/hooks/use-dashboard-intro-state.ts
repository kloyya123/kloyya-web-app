import { useEffect, useState } from 'react';

const JUST_ONBOARDED_KEY = 'kloyya:just-onboarded';

/**
 * The welcome modal and tour show exactly once: right after `WorkspaceInit`
 * finishes and hands off to the dashboard, never on a plain first-ever visit.
 *
 * Both start "seen" by default — the visit only becomes an onboarding moment
 * if `sessionStorage` carries the one-shot flag `WorkspaceInit` set just
 * before its redirect. That flag is read and cleared here, once, so refreshing
 * the dashboard or opening it again later — even in a brand-new tab — never
 * re-triggers it. Session-scoped rather than persisted: there is nothing to
 * remember across a browser restart, because the flag being absent is already
 * the correct "don't show" state.
 */
export function useDashboardIntroState() {
  const [hasSeenIntro, setHasSeenIntro] = useState(true);
  const [hasSeenTour, setHasSeenTour] = useState(true);

  useEffect(() => {
    if (sessionStorage.getItem(JUST_ONBOARDED_KEY) !== 'true') return;
    sessionStorage.removeItem(JUST_ONBOARDED_KEY);
    setHasSeenIntro(false);
    setHasSeenTour(false);
  }, []);

  const dismissIntro = () => setHasSeenIntro(true);
  const completeTour = () => setHasSeenTour(true);

  return {
    hasSeenIntro,
    hasSeenTour,
    dismissIntro,
    completeTour,
  };
}
