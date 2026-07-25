import { useEffect, useState } from 'react';

const INTRO_SEEN_KEY = 'kloyya:dashboard-intro-seen';

export function useDashboardIntroState() {
  const [hasSeenIntro, setHasSeenIntro] = useState(false);
  const [hasSeenTour, setHasSeenTour] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(INTRO_SEEN_KEY);
    if (stored === 'true') {
      setHasSeenIntro(true);
      setHasSeenTour(true);
    }
  }, []);

  const dismissIntro = () => {
    setHasSeenIntro(true);
  };

  const completeTour = () => {
    setHasSeenTour(true);
    localStorage.setItem(INTRO_SEEN_KEY, 'true');
  };

  return {
    hasSeenIntro,
    hasSeenTour,
    dismissIntro,
    completeTour,
  };
}
