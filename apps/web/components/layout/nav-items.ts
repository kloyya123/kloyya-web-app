import {
  BarChart3,
  Calendar,
  CheckSquare,
  FolderKanban,
  House,
  Inbox,
  Library,
  ShieldCheck,
  Sparkles,
  Waypoints,
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
 * The primary navigation — matched to the reference dashboard.
 *
 * Home, Ask Kloyya, Inbox, Tasks, Calendar, Knowledge, Projects, Connections,
 * Trust Centre, Analytics. Settings and Help & Support live in the sidebar
 * footer, not this list. Organizations are removed from the product surface for
 * the private beta (everything operates around a single Workspace); the org
 * tenancy still exists internally, it just has no navigation.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: House },
  { href: '/ask', label: 'Ask Kloyya', icon: Sparkles },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/knowledge', label: 'Knowledge', icon: Library },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/connections', label: 'Connections', icon: Waypoints },
  { href: '/trust', label: 'Trust Centre', icon: ShieldCheck },
  { href: '/recommendations', label: 'Analytics', icon: BarChart3 },
];
