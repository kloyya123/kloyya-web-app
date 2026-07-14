'use client';

import {
  Calendar,
  FileText,
  Folder,
  Mail,
  MessageSquare,
  Settings2,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Badge, Separator } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';
import type {
  DataClassification,
  Evidence,
  EvidenceSourceType,
  NonEmpty,
} from '@/types/domain';

/**
 * KDS AI Components: "Evidence Panel", "Source References".
 * DCTF Golden Rules: "Always show supporting context. Always allow users to verify."
 *
 * Every recommendation's evidence is inspectable here: what the source said,
 * when it last changed, how reliable it is, and a link to the original. The
 * excerpt is rendered as text, never as HTML — evidence originates in email and
 * documents, which is untrusted content by definition.
 */

const SOURCE_ICON: Record<EvidenceSourceType, LucideIcon> = {
  email: Mail,
  calendar: Calendar,
  meeting_notes: Users,
  document: FileText,
  knowledge_base: Sparkles,
  crm: Users,
  project_update: Folder,
  task_history: Folder,
  chat: MessageSquare,
  user_preference: Settings2,
  integration: Settings2,
};

/**
 * KESM data classification. Only the levels above `internal` are labelled:
 * badging every internal document would be noise, and noise is how a
 * classification label stops being read.
 */
const CLASSIFICATION_LABEL: Partial<Record<DataClassification, string>> = {
  confidential: 'Confidential',
  highly_confidential: 'Highly confidential',
  restricted: 'Restricted',
  regulated: 'Regulated',
};

export interface EvidenceViewerProps {
  /** Non-empty by construction. There is no empty state, because there cannot be one. */
  evidence: NonEmpty<Evidence>;
  className?: string;
}

export function EvidenceViewer({ evidence, className }: EvidenceViewerProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-caption text-muted-foreground">
        {evidence.length === 1
          ? 'Based on one source.'
          : `Based on ${evidence.length} sources.`}
      </p>

      <ul className="space-y-2">
        {evidence.map((item) => (
          <li key={item.id}>
            <EvidenceItem evidence={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EvidenceItem({ evidence }: { evidence: Evidence }) {
  const Icon = SOURCE_ICON[evidence.sourceType];
  const classification = CLASSIFICATION_LABEL[evidence.classification];

  return (
    <div className="border-border bg-surface rounded-sm border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon aria-hidden="true" className="text-muted-foreground size-3.5 shrink-0" />
          <span className="text-caption text-foreground truncate font-medium">
            {evidence.sourceLabel}
          </span>
        </div>

        {classification ? (
          <Badge tone="warning" className="shrink-0">
            {classification}
          </Badge>
        ) : null}
      </div>

      {/*
        Rendered as a text node. This content came from an inbox; it is never
        trusted, and never passed through dangerouslySetInnerHTML.
      */}
      <blockquote className="text-small text-muted-foreground border-border mt-2 border-l-2 pl-3 italic">
        {evidence.excerpt}
      </blockquote>

      <div className="text-caption text-subtle mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          Updated <time dateTime={evidence.timestamp}>{formatRelativeTime(evidence.timestamp)}</time>
        </span>
        <Separator orientation="vertical" className="h-3" />
        <span>{evidence.reliability}% reliable</span>
        <Separator orientation="vertical" className="h-3" />
        <span>{evidence.freshness}% fresh</span>

        {evidence.href ? (
          <>
            <Separator orientation="vertical" className="h-3" />
            <Link
              href={evidence.href}
              className="text-link rounded-sm hover:underline"
            >
              Open source
              <span className="sr-only"> for {evidence.sourceLabel}</span>
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The compact form. A row of source chips, for places where the full evidence
 * panel would dominate — a briefing headline, a search result.
 */
export function SourceReferences({ evidence }: { evidence: NonEmpty<Evidence> }) {
  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {evidence.map((item) => {
        const Icon = SOURCE_ICON[item.sourceType];
        return (
          <li key={item.id}>
            <Badge tone="neutral">
              <Icon aria-hidden="true" className="size-3" />
              {item.sourceLabel}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}
