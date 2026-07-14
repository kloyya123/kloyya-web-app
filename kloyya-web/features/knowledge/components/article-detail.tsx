'use client';

import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { ConfidenceBadge } from '@/components/ai';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from '@/components/ui';
import { toErrorPresentation } from '@/lib/error-presentation';
import { formatDate } from '@/lib/format';
import type { GraphNode } from '@/types/knowledge';
import { useArticle, useKnowledgeGraph } from '../hooks/use-knowledge';
import { EntityGlyph } from './entity-glyph';

/**
 * One article: the summary and its confidence up top, the body below, and the
 * entities it draws on — resolved from the graph — as links back into the live
 * surfaces. A decision record you can read, then trace.
 */
export function ArticleDetail({ id }: { id: string }) {
  const { data: article, isPending, isError, error, refetch } = useArticle(id);

  if (isPending) {
    return (
      <LoadingRegion label="Loading the article" className="space-y-4">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </LoadingRegion>
    );
  }

  if (isError) {
    return (
      <Card>
        <ErrorState error={toErrorPresentation(error)} onRetry={() => void refetch()} />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/knowledge"
        className="text-caption text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        Knowledge
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{article.category}</Badge>
          <ConfidenceBadge confidence={article.confidence} />
        </div>
        <h1 className="text-heading-m text-foreground font-semibold text-balance">
          {article.title}
        </h1>
        <p className="text-caption text-subtle tabular-nums">
          Updated {formatDate(article.updatedAt)}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <p className="text-body text-muted-foreground mb-5 leading-relaxed">
                {article.aiSummary}
              </p>
              <div className="space-y-4">
                {article.body.split('\n\n').map((paragraph) => (
                  <p key={paragraph} className="text-body text-foreground leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>

          {article.tags.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {article.tags.map((tag) => (
                <li key={tag} className="text-caption text-subtle bg-muted/12 rounded px-2 py-0.5">
                  #{tag}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <aside>
          <RelatedEntities relatedNodeIds={article.relatedNodeIds} />
        </aside>
      </div>
    </div>
  );
}

function RelatedEntities({ relatedNodeIds }: { relatedNodeIds: string[] }) {
  const { data: graph, isPending } = useKnowledgeGraph();

  const nodes: GraphNode[] = graph
    ? relatedNodeIds
        .map((nodeId) => graph.nodes.find((n) => n.id === nodeId))
        .filter((n): n is GraphNode => n !== undefined)
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Draws on</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
          </div>
        ) : nodes.length === 0 ? (
          <p className="text-small text-muted-foreground">No linked records.</p>
        ) : (
          <ul className="space-y-1.5">
            {nodes.map((node) => (
              <li key={node.id}>
                {node.entityHref ? (
                  <Link
                    href={node.entityHref}
                    className="border-border hover:bg-hover flex items-center justify-between gap-2 rounded-md border p-2.5"
                  >
                    <EntityGlyph node={node} />
                    <ArrowUpRight aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
                  </Link>
                ) : (
                  <div className="border-border flex items-center gap-2 rounded-md border p-2.5">
                    <EntityGlyph node={node} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
