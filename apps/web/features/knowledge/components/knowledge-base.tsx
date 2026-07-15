'use client';

import { Library, Network } from 'lucide-react';
import Link from 'next/link';
import { ConfidenceBadge } from '@/components/ai';
import { useUrlState } from '@/hooks/use-url-state';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  ErrorState,
  FilterChip,
  LoadingRegion,
  Skeleton,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { toErrorPresentation } from '@/lib/error-presentation';
import type { KnowledgeArticle } from '@/types/domain';
import { useArticles } from '../hooks/use-knowledge';
import { KnowledgeGraphView } from './knowledge-graph';

type View = 'articles' | 'graph';

/**
 * The knowledge surface: a curated base of decisions and playbooks, and the
 * graph that shows how the organization's work connects. One toggle between
 * them — the base is where you read, the graph is where you trace.
 */
export function KnowledgeBase() {
  // Both live in the URL, so "the Decisions articles" and "the graph" are each a
  // link you can send someone.
  const [view, setView] = useUrlState<View>('view', 'articles');

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-heading-m text-foreground font-semibold">Knowledge</h1>
        <p className="text-small text-muted-foreground">
          What the organization knows, and how it connects — every claim traceable
          to the record behind it.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Knowledge view"
        className="border-border inline-flex gap-1 rounded-md border p-1"
      >
        <ViewTab icon={Library} label="Articles" active={view === 'articles'} onClick={() => setView('articles')} />
        <ViewTab icon={Network} label="Graph" active={view === 'graph'} onClick={() => setView('graph')} />
      </div>

      {view === 'articles' ? <ArticlesPanel /> : <KnowledgeGraphView />}
    </div>
  );
}

function ViewTab({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Library;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'text-small inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 font-medium transition-colors',
        active ? 'bg-intelligence-blue/12 text-link' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}

const ALL = 'All';

function ArticlesPanel() {
  const [category, setCategory] = useUrlState<string>('category', ALL);
  const { data, isPending, isError, error, refetch } = useArticles(
    category === ALL ? {} : { category },
  );

  if (isPending) {
    return (
      <LoadingRegion label="Loading the knowledge base" className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
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
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        <FilterChip active={category === ALL} onClick={() => setCategory(ALL)}>
          {ALL}
        </FilterChip>
        {data.categories.map((cat) => (
          <FilterChip key={cat} active={category === cat} onClick={() => setCategory(cat)}>
            {cat}
          </FilterChip>
        ))}
      </div>

      {data.articles.length === 0 ? (
        <Card>
          <EmptyState
            icon={Library}
            title="Nothing here yet."
            description="Curated decisions and playbooks will collect in this category."
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {data.articles.map((article) => (
            <li key={article.id}>
              <ArticleCard article={article} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ArticleCard({ article }: { article: KnowledgeArticle }) {
  return (
    <Link href={`/knowledge/${article.id}`} className="group block h-full rounded-lg">
      <Card className="group-hover:border-muted flex h-full flex-col transition-colors">
        <CardHeader className="flex-col items-stretch gap-2">
          <div className="flex items-center justify-between gap-2">
            <Badge tone="neutral">{article.category}</Badge>
            <ConfidenceBadge confidence={article.confidence} />
          </div>
          <h2 className="text-title text-foreground font-semibold text-balance">
            {article.title}
          </h2>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          <p className="text-small text-muted-foreground line-clamp-3 flex-1">
            {article.aiSummary}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {article.tags.map((tag) => (
              <li key={tag} className="text-caption text-subtle bg-muted/12 rounded px-1.5 py-0.5">
                #{tag}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </Link>
  );
}
