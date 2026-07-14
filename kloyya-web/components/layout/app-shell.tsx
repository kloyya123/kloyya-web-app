'use client';

import { useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  LoadingRegion,
  Skeleton,
} from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { CommandPalette } from './command-palette';
import { Sidebar } from './sidebar';
import { TopBar } from './topbar';

/**
 * The authenticated shell. Every app route inherits it.
 *
 * KFA layout system: Root → Dashboard Layout → Feature Layout → Page.
 * The sidebar is persistent on desktop and a focus-trapped dialog on mobile.
 *
 * Middleware has already guaranteed a session before this renders, so the null
 * branch below is not a route guard — it is the one frame between mount and the
 * cookie read resolving. It shows the shell's own skeleton rather than nothing.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  if (isLoading || !session) return <AppShellSkeleton />;

  return (
    <div className="bg-background flex min-h-dvh">
      <Sidebar className="hidden lg:flex" />

      {/* Mobile navigation. Radix Dialog gives it the focus trap and Escape. */}
      <Dialog open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
        <DialogContent
          size="sm"
          className="top-0 left-0 h-dvh max-w-(--container-sidebar) translate-x-0 translate-y-0 rounded-none p-0"
        >
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <DialogDescription className="sr-only">
            Move between the sections of your workspace.
          </DialogDescription>
          <Sidebar className="w-full border-r-0" />
        </DialogContent>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          user={session.user}
          organization={session.organization}
          workspace={session.workspace}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
        />

        {/*
          overflow-x-clip: the page frame never scrolls sideways (WCAG 1.4.10
          Reflow). Wide content — the tasks table, the calendar grid, the
          knowledge graph — each carries its own `overflow-x-auto` container and
          still scrolls inside itself, so nothing becomes unreachable. This is a
          frame guard, not a way to hide a layout bug: every known offender was
          fixed at its source first (grid columns given an explicit minmax(0,1fr)
          base), and this stops the next one from breaking the whole page.
        */}
        <main
          id="main"
          className="mx-auto w-full max-w-(--container-content) flex-1 overflow-x-clip px-4 py-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}

function AppShellSkeleton() {
  return (
    <div className="bg-background flex min-h-dvh">
      <div className="border-border hidden w-(--container-sidebar) shrink-0 border-r lg:block" />
      <div className="flex-1">
        <div className="border-border h-16 border-b" />
        <LoadingRegion label="Loading your workspace" className="space-y-4 p-8">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </LoadingRegion>
      </div>
    </div>
  );
}
