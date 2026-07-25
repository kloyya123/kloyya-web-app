'use client';

import { ArrowRight, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Kloyya',
    description: 'Your AI Chief of Staff is ready to help. This quick tour will show you the key features.',
    targetSelector: 'h1',
    position: 'bottom',
  },
  {
    id: 'ask',
    title: 'Ask Kloyya',
    description: 'Ask anything about your work. Get summaries, decisions, recommendations.',
    targetSelector: '[data-tour="ask-box"]',
    position: 'bottom',
  },
  {
    id: 'search',
    title: 'Search your work',
    description: 'Find messages, documents, and decisions across all your connected tools.',
    targetSelector: '[data-tour="search"]',
    position: 'bottom',
  },
  {
    id: 'create',
    title: 'Create anything',
    description: 'New tasks, drafts, projects, and meetings from one place.',
    targetSelector: 'button:has-text("New")',
    position: 'bottom',
  },
  {
    id: 'ready',
    title: 'You&apos;re ready',
    description: 'Explore Kloyya at your own pace. You can find this tour anytime in Settings.',
    targetSelector: 'h1',
    position: 'bottom',
  },
];

interface DashboardTourProps {
  isVisible: boolean;
  onComplete: () => void;
}

export function DashboardTour({ isVisible, onComplete }: DashboardTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [tooltip, setTooltip] = useState<{
    top: number;
    left: number;
    maxWidth: number;
  } | null>(null);
  const [overlay, setOverlay] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentStep = TOUR_STEPS[stepIndex];
  const isLastStep = currentStep ? stepIndex === TOUR_STEPS.length - 1 : false;

  useEffect(() => {
    if (!isVisible || !currentStep) return;

    // Find the target element
    const target = document.querySelector(currentStep.targetSelector);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const gap = 16;

    // Calculate overlay position (highlight box around target)
    setOverlay({
      top: rect.top - 8,
      left: rect.left - 8,
      width: rect.width + 16,
      height: rect.height + 16,
    });

    // Calculate tooltip position
    const tooltipWidth = Math.min(320, window.innerWidth - 32);
    let top = rect.top;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;

    // Adjust based on position
    if (currentStep.position === 'bottom') {
      top = rect.bottom + gap;
    } else if (currentStep.position === 'top') {
      top = rect.top - gap - 120; // Approximate tooltip height
    }

    // Keep tooltip within viewport
    if (left < 16) left = 16;
    if (left + tooltipWidth > window.innerWidth - 16) {
      left = window.innerWidth - tooltipWidth - 16;
    }

    setTooltip({
      top: Math.max(16, top),
      left,
      maxWidth: tooltipWidth,
    });
  }, [isVisible, currentStep]);

  if (!isVisible || !currentStep) return null;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <>
      {/* Overlay backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 pointer-events-none" />

      {/* Highlight box around target */}
      {overlay && (
        <div
          className="fixed z-40 border-2 border-blue-500 rounded-lg pointer-events-none shadow-lg"
          style={{
            top: `${overlay.top}px`,
            left: `${overlay.left}px`,
            width: `${overlay.width}px`,
            height: `${overlay.height}px`,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)',
          }}
        />
      )}

      {/* Tooltip */}
      {tooltip && currentStep && (
        <div
          ref={tooltipRef}
          className="fixed z-50 bg-foreground text-background rounded-lg shadow-2xl p-4 pointer-events-auto"
          style={{
            top: `${tooltip.top}px`,
            left: `${tooltip.left}px`,
            maxWidth: `${tooltip.maxWidth}px`,
          }}
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <h3 className="font-semibold text-sm">
                  {currentStep.title}
                </h3>
                <p className="text-xs text-background/80">
                  {currentStep.description}
                </p>
              </div>
              <button
                onClick={handleSkip}
                className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
                aria-label="Close tour"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1">
                {TOUR_STEPS.map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      'h-1 w-1.5 rounded-full transition-colors',
                      index <= stepIndex
                        ? 'bg-blue-400'
                        : 'bg-background/30',
                    )}
                  />
                ))}
              </div>
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium transition-colors active:scale-95"
              >
                {isLastStep ? 'Done' : 'Next'}
                {!isLastStep && <ArrowRight className="size-3" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
