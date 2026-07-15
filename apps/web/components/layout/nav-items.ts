import {
  Building2,
  Calendar,
  CheckSquare,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  Lightbulb,
  Library,
  Plug,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Not yet built. Rendered, but visibly and accessibly marked as unavailable. */
  isComingSoon?: boolean;
  /** Starts a new visual group in the sidebar. */
  startsGroup?: boolean;
}

/**
 * The primary navigation, in the order the roadmap builds it.
 *
 * Routes not yet implemented are marked rather than hidden. Hiding them would
 * make the product look smaller than it is; linking them would send the user to
 * a 404. A disabled item with a "Soon" badge tells the truth.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/meetings', label: 'Meetings', icon: Users },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/knowledge', label: 'Knowledge', icon: Library },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/organization', label: 'Organization', icon: Building2 },
  { href: '/recommendations', label: 'Recommendations', icon: Lightbulb },
  // These surfaces sit in their own group — they are about Kloyya itself, not a
  // place work lives.
  { href: '/connections', label: 'Connect tools', icon: Plug, startsGroup: true },
  { href: '/trust', label: 'Trust Center', icon: ShieldCheck },
];
