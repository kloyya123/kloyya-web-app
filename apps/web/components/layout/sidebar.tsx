'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/brand/logo';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { NAV_ITEMS, type NavItem } from './nav-items';

/**
 * The primary navigation.
 *
 * Fixed at the KDS sidebar width (280px). `aria-current="page"` marks the active
 * route for assistive tech — a blue background is not an announcement.
 */
export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'bg-surface border-border flex h-full w-(--container-sidebar) shrink-0 flex-col border-r',
        className,
      )}
    >
      <div className="flex h-16 items-center px-6">
        <Link href="/dashboard" className="rounded-sm">
          <Logo />
        </Link>
      </div>

      <ul className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <li key={item.href} className={item.startsGroup ? 'border-border mt-3 border-t pt-3' : undefined}>
            <SidebarLink
              item={item}
              isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
            />
          </li>
        ))}
      </ul>

      <div className="border-border border-t px-6 py-4">
        <p className="text-caption text-subtle">The Intelligence Behind Every Decision.</p>
      </div>
    </nav>
  );
}

function SidebarLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;

  const content = (
    <>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.isComingSoon ? <Badge tone="neutral">Soon</Badge> : null}
    </>
  );

  const shared = cn(
    'flex items-center gap-3 rounded-sm px-3 py-2 text-small font-medium',
    'transition-colors duration-150 ease-out',
  );

  // Not a link, because it goes nowhere. `aria-disabled` on an anchor would
  // still be focusable and clickable; a span with the state stated is honest.
  if (item.isComingSoon) {
    return (
      <span className={cn(shared, 'text-subtle cursor-not-allowed')}>
        {content}
        <span className="sr-only">, not available yet</span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        shared,
        isActive
          ? 'bg-intelligence-blue/12 text-link'
          : 'text-muted-foreground hover:bg-hover hover:text-foreground',
      )}
    >
      {content}
    </Link>
  );
}
