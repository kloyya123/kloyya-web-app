'use client';

import { ArrowRight, Calendar, CheckSquare, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui';

interface QuickLink {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const QUICK_LINKS: QuickLink[] = [
  {
    href: '/inbox',
    label: 'Inbox',
    description: 'Your messages and priorities',
    icon: <MessageSquare className="size-5" />,
  },
  {
    href: '/calendar',
    label: 'Calendar',
    description: 'Today and coming up',
    icon: <Calendar className="size-5" />,
  },
  {
    href: '/tasks',
    label: 'Tasks',
    description: 'Your priorities and deadlines',
    icon: <CheckSquare className="size-5" />,
  },
  {
    href: '/ask',
    label: 'Ask Kloyya',
    description: 'Your AI Chief of Staff',
    icon: <MessageSquare className="size-5" />,
  },
];

export function DashboardIntro({ onDismiss }: { onDismiss: () => void }) {
  const [isVisible, setIsVisible] = useState(true);

  function dismiss() {
    setIsVisible(false);
    onDismiss();
  }

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4 py-12 backdrop-blur-sm">
      <div className="bg-background max-w-2xl w-full rounded-lg shadow-lg overflow-hidden">
        <div className="space-y-8 p-8 sm:p-12 text-center">
          <div className="space-y-3">
            <div className="text-5xl">🎉</div>
            <h1 className="text-heading-l text-foreground font-semibold">
              You&apos;re all set
            </h1>
            <p className="text-medium text-muted-foreground">
              Your workspace is ready. Here&apos;s where to start.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={dismiss}
                className="group relative flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-link hover:bg-card/80 active:scale-95"
              >
                <div className="text-link">
                  {link.icon}
                </div>
                <div>
                  <p className="font-medium text-foreground group-hover:text-link transition-colors">
                    {link.label}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {link.description}
                  </p>
                </div>
                <ArrowRight className="absolute top-4 right-4 size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>

          <div className="flex flex-col items-center gap-3 pt-4">
            <Button size="lg" onClick={dismiss}>
              Go to Dashboard
            </Button>
            <p className="text-caption text-muted-foreground">
              You can access these anytime from the sidebar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
