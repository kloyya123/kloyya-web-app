'use client';

import { CircleHelp, Settings, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo, LogoMark } from '@/components/brand/logo';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useInboxList } from '@/hooks/use-inbox';
import { NAV_ITEMS, type NavItem } from './nav-items';

/**
 * The primary navigation.
 *
 * Fixed at the KDS sidebar width. `aria-current="page"` marks the active route
 * for assistive tech — a blue background is not an announcement. Matched to the
 * reference: main nav, then Settings + Help in the footer, then an upgrade card.
 */
export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { data: inbox } = useInboxList();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

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
          <li key={item.href}>
            <SidebarLink
              item={item}
              isActive={isActive(item.href)}
              badge={item.href === '/inbox' ? inbox?.unreadCount : undefined}
            />
          </li>
        ))}
      </ul>

      <div className="space-y-1 px-3 py-4">
        <SidebarLink
          item={{ href: '/settings', label: 'Settings', icon: Settings }}
          isActive={isActive('/settings')}
        />
        <SidebarLink
          item={{ href: '/settings', label: 'Help & Support', icon: CircleHelp }}
          isActive={false}
        />
      </div>

      <div className="px-3 pb-4">
        <Link
          href="/settings"
          className="border-border hover:border-primary/40 flex items-center gap-3 rounded-lg border p-3 transition-colors"
        >
          <span className="bg-primary/10 text-primary inline-flex size-8 shrink-0 items-center justify-center rounded-full">
            <Sparkles aria-hidden="true" className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="text-small text-foreground block font-medium">Upgrade plan</span>
            <span className="text-caption text-subtle block">Unlock more features</span>
          </span>
        </Link>
      </div>
    </nav>
  );
}

function SidebarLink({
  item,
  isActive,
  badge,
}: {
  item: NavItem;
  isActive: boolean;
  badge?: number | undefined;
}) {
  const Icon = item.icon;
  // Ask Kloyya carries our own mark, not a generic sparkle — the same brand
  // treatment as the Ask surfaces themselves.
  const isAskKloyya = item.href === '/ask';

  const content = (
    <>
      {isAskKloyya ? (
        <LogoMark decorative className="size-4 shrink-0" />
      ) : (
        <Icon aria-hidden="true" className="size-4 shrink-0" />
      )}
      <span className="flex-1 truncate">{item.label}</span>
      {badge && badge > 0 ? (
        <span className="bg-primary/15 text-primary rounded-full px-1.5 text-caption font-semibold tabular-nums">
          {badge}
        </span>
      ) : null}
      {item.isComingSoon ? <Badge tone="neutral">Soon</Badge> : null}
    </>
  );

  const shared = cn(
    'flex items-center gap-3 rounded-sm px-3 py-2 text-small font-medium',
    'transition-colors duration-150 ease-out',
  );

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
