import {
  CheckSquare,
  FolderKanban,
  Library,
  Lightbulb,
  Mail,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { SearchKind } from '@/types/search';

/**
 * Icon and headings per search kind. Shared (not feature-local) because both the
 * dedicated Search page and the ⌘K palette in the app shell render results, and
 * the shell may not reach into a feature. Group labels are plural.
 */
export const SEARCH_KIND_META: Record<SearchKind, { icon: LucideIcon; group: string }> = {
  task: { icon: CheckSquare, group: 'Tasks' },
  meeting: { icon: Users, group: 'Meetings' },
  email: { icon: Mail, group: 'Emails' },
  project: { icon: FolderKanban, group: 'Projects' },
  person: { icon: User, group: 'People' },
  article: { icon: Library, group: 'Knowledge' },
  recommendation: { icon: Lightbulb, group: 'Recommendations' },
};

/** The order kinds appear in grouped results. */
export const SEARCH_KIND_ORDER: SearchKind[] = [
  'recommendation',
  'task',
  'meeting',
  'email',
  'project',
  'person',
  'article',
];
