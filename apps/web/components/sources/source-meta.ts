import {
  Boxes,
  Brain,
  Calendar,
  FileText,
  Github,
  HardDrive,
  Hash,
  Mail,
  MessageSquare,
  Network,
  Settings2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type {
  SourceCategory,
  SourcePermission,
  SourceProvider,
  SourceStatus,
} from '@/types/sources';
import type { BadgeTone } from '@/components/ui';

/**
 * Presentation metadata for connected sources.
 *
 * Lucide has no brand logos (and shipping vendor SVGs would bloat the bundle and
 * raise licensing questions), so each provider maps to a representative outline
 * icon. Honest and light: the label carries the brand, the icon carries the kind.
 */
const PROVIDER_ICON: Record<SourceProvider, LucideIcon> = {
  gmail: Mail,
  google_calendar: Calendar,
  microsoft_calendar: Calendar,
  google_drive: HardDrive,
  onedrive: HardDrive,
  dropbox: HardDrive,
  notion: FileText,
  confluence: FileText,
  slack: Hash,
  microsoft_teams: MessageSquare,
  salesforce: Users,
  hubspot: Users,
  jira: Boxes,
  github: Github,
  organization_memory: Brain,
  knowledge_graph: Network,
  context_engine: Settings2,
};

export function providerIcon(provider: SourceProvider): LucideIcon {
  return PROVIDER_ICON[provider];
}

export const CATEGORY_LABEL: Record<SourceCategory, string> = {
  personal: 'Personal',
  organization: 'Organization',
  external: 'External',
  ai: 'AI Intelligence',
};

/** Status → tone + label + whether it is a working state. */
export const STATUS_META: Record<
  SourceStatus,
  { label: string; tone: BadgeTone; isWorking: boolean }
> = {
  healthy: { label: 'Healthy', tone: 'success', isWorking: true },
  syncing: { label: 'Syncing', tone: 'info', isWorking: true },
  needs_attention: { label: 'Needs attention', tone: 'warning', isWorking: false },
  token_expired: { label: 'Re-authorize', tone: 'danger', isWorking: false },
  disconnected: { label: 'Disconnected', tone: 'neutral', isWorking: false },
};

export const PERMISSION_LABEL: Record<SourcePermission, string> = {
  read_only: 'Read only',
  read_write: 'Read & write',
  ai_read: 'AI read access',
  admin: 'Administrator',
};
