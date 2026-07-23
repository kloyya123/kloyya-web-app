import {
  BarChart3,
  Calendar,
  CheckSquare,
  FileStack,
  FolderKanban,
  House,
  Inbox,
  Library,
  PenLine,
  ShieldCheck,
  Sparkles,
  Users,
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
 * The primary navigation — matched to the reference dashboard, plus three fully
 * built pages the reference screenshot's sidebar had no room to show but that
 * must stay reachable: `Documents` (upload/list/delete files), `Meetings`
 * (calendar-adjacent), and `Drafts` (autosaving writing surface).
 *
 * Settings and Help & Support live in the sidebar footer, not this list.
 * Organizations are removed from the product surface for the private beta
 * (everything operates around a single Workspace); the org tenancy still
 * exists internally, it just has no navigation.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: House },
  { href: '/ask', label: 'Ask Kloyya', icon: Sparkles },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/meetings', label: 'Meetings', icon: Users },
  { href: '/knowledge', label: 'Knowledge', icon: Library },
  { href: '/documents', label: 'Documents', icon: FileStack },
  { href: '/drafts', label: 'Drafts', icon: PenLine },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/connections', label: 'Connections', icon: Waypoints },
  { href: '/trust', label: 'Trust Centre', icon: ShieldCheck },
  { href: '/recommendations', label: 'Analytics', icon: BarChart3 },
];
