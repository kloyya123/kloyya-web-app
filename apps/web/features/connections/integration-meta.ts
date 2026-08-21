import {
  Boxes,
  Brain,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  Github,
  HardDrive,
  Hash,
  LineChart,
  Mail,
  MessageSquare,
  PenTool,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { BadgeTone } from '@/components/ui';
import type { ConnectionStatus, IntegrationCategory } from '@/types/integrations';
import { BRAND_ICONS } from './brand-icons';

/**
 * Presentation metadata for the integration catalogue.
 *
 * Lucide ships no brand logos, and bundling ~50 vendor SVGs would bloat the
 * build and raise licensing questions. So each app takes a representative
 * outline icon — by category, with a few overrides where a category icon would
 * mislead (GitHub, Figma). The card's name carries the brand; the icon carries
 * the kind. Same honest approach as the Trust Center's source icons.
 *
 * The tools that are actually live today (Gmail, Google Calendar, Google
 * Drive, Notion, Slack) are the exception: `integrationIcon` reaches for a
 * real, brand-colored mark for those first (see `./brand-icons.tsx`) — five
 * hand-built SVGs is not the ~50-vendor bloat the reasoning above is about,
 * and a user looking at their own connected tools should see the logo they
 * already recognize, not a generic envelope.
 */
const CATEGORY_ICON: Record<IntegrationCategory, LucideIcon> = {
  communication: Mail,
  calendar: Calendar,
  documents: FileText,
  project_management: Boxes,
  crm: Users,
  engineering: Github,
  design: PenTool,
  meetings: Video,
  finance: CreditCard,
  cloud_storage: HardDrive,
  ai_productivity: Brain,
  hr: Building2,
  marketing: LineChart,
  custom: Hash,
};

const ID_ICON: Record<string, LucideIcon> = {
  slack: Hash,
  microsoft_teams: MessageSquare,
  discord: MessageSquare,
  github: Github,
  gitlab: Github,
  bitbucket: Github,
};

/** A brand icon and a `LucideIcon` differ in their full prop surface, but every
 *  call site here only ever passes `className`/`aria-hidden` — the common
 *  subset both satisfy. */
type IntegrationIcon = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;

export function integrationIcon(id: string, category: IntegrationCategory): IntegrationIcon {
  return BRAND_ICONS[id] ?? ID_ICON[id] ?? CATEGORY_ICON[category];
}

/**
 * Status → how it reads. `isConnected` decides whether the card shows management
 * actions (pause, disconnect, sync) or a single Connect button.
 */
export const CONNECTION_STATUS_META: Record<
  ConnectionStatus,
  { label: string; tone: BadgeTone; isConnected: boolean }
> = {
  not_connected: { label: 'Not connected', tone: 'neutral', isConnected: false },
  connecting: { label: 'Connecting', tone: 'info', isConnected: true },
  syncing: { label: 'Syncing', tone: 'info', isConnected: true },
  connected: { label: 'Connected', tone: 'success', isConnected: true },
  paused: { label: 'Paused', tone: 'warning', isConnected: true },
  error: { label: 'Needs attention', tone: 'danger', isConnected: true },
};

/** The staged sync shown while an integration connects. From the spec's Step 5. */
export const SYNC_STAGES = [
  'Reading structure',
  'Indexing content',
  'Extracting relationships',
  'Building knowledge',
  'Creating embeddings',
] as const;

/**
 * How each category reads in the UI. Presentation, not data — it sits beside
 * CATEGORY_ICON rather than in mock/, so the mock folder can be deleted the day
 * a real backend lands without taking the interface's vocabulary with it.
 */
export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  communication: 'Communication',
  calendar: 'Calendar',
  documents: 'Documents & Knowledge',
  project_management: 'Project Management',
  crm: 'CRM & Sales',
  engineering: 'Engineering',
  design: 'Design',
  meetings: 'Meetings',
  finance: 'Finance',
  cloud_storage: 'Cloud Storage',
  ai_productivity: 'AI & Productivity',
  hr: 'HR',
  marketing: 'Marketing',
  custom: 'Custom APIs',
};
