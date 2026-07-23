'use client';

import { ArrowRight, File, FileSpreadsheet, FileText, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, Skeleton } from '@/components/ui';
import { formatRelativeTime } from '@/lib/format';
import { services } from '@/services';
import { SidebarCard } from './dashboard';

/**
 * What's landed in Documents lately.
 *
 * Sourced from the real documents list — not a cross-tool file-activity feed,
 * which Kloyya doesn't have yet. Every row here is a document that is actually
 * in the workspace, uploaded by someone in it, at the time shown.
 */
function iconFor(mimeType: string) {
  if (mimeType.startsWith('image/')) return ImageIcon;
  if (mimeType.includes('sheet') || mimeType.includes('csv')) return FileSpreadsheet;
  if (mimeType.includes('text') || mimeType.includes('document')) return FileText;
  return File;
}

export function RecentActivityCard() {
  const { data, isPending } = useQuery({
    queryKey: ['documents', 'list'],
    queryFn: () => services.documents.list(),
    staleTime: 30_000,
  });

  const items = data?.items.slice(0, 4) ?? [];

  return (
    <SidebarCard
      title="Recent activity"
      action={
        <Link
          href="/documents"
          className="text-caption text-link inline-flex items-center gap-1 rounded-sm hover:underline"
        >
          View all
          <ArrowRight aria-hidden="true" className="size-3" />
        </Link>
      }
    >
      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nothing uploaded yet."
          description="Documents you add will show up here."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((doc) => {
            const Icon = iconFor(doc.mimeType);
            return (
              <li key={doc.id} className="flex items-start gap-2.5">
                <Icon aria-hidden="true" className="text-subtle mt-0.5 size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-small text-foreground truncate font-medium">{doc.name}</p>
                  <p className="text-caption text-subtle">
                    Uploaded {formatRelativeTime(doc.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SidebarCard>
  );
}
