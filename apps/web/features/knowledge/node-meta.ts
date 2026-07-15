import {
  Building2,
  CheckSquare,
  FolderKanban,
  Gavel,
  Mail,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { GraphNodeKind } from '@/types/knowledge';

/**
 * How each entity kind reads in the graph — one icon, one colour, one word.
 *
 * `cssVar` resolves to a KDS token so the SVG and the badges share the exact
 * palette the rest of the app uses; `noun` is what the connections panel calls
 * the kind in prose. Meaning is never carried by colour alone — the icon and the
 * noun both state the kind (WCAG 1.4.1).
 */
export interface NodeMeta {
  icon: LucideIcon;
  /** A CSS color token, applied to SVG fill/stroke via inline style. */
  cssVar: string;
  noun: string;
}

export const NODE_META: Record<GraphNodeKind, NodeMeta> = {
  person: { icon: User, cssVar: 'var(--color-info)', noun: 'Person' },
  project: { icon: FolderKanban, cssVar: 'var(--color-executive-purple)', noun: 'Project' },
  meeting: { icon: Users, cssVar: 'var(--color-intelligence-blue)', noun: 'Meeting' },
  email: { icon: Mail, cssVar: 'var(--color-success)', noun: 'Email' },
  task: { icon: CheckSquare, cssVar: 'var(--color-warning)', noun: 'Task' },
  decision: { icon: Gavel, cssVar: 'var(--color-danger)', noun: 'Decision' },
  organization: { icon: Building2, cssVar: 'var(--color-muted)', noun: 'Organization' },
};
