'use client';

import { ArrowUpRight, Search as SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDeferredValue, useEffect, useState } from 'react';
import {
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingRegion,
  Skeleton,
} from '@/components/ui';
import { SEARCH_KIND_META, SEARCH_KIND_ORDER } from '@/components/search/search-meta';
import { useSearch } from '@/hooks/use-search';
import { toErrorPresentation } from '@/lib/error-presentation';
import type { SearchKind, SearchResult } from '@/types/search';

/**
 * The dedicated search surface. The query lives in the URL (`?q=`), so a search
 * is shareable, bookmarkable, and survives a refresh — the canonical URL-state
 * feature. Results group by kind and each opens the live record.
 */
export function SearchView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get('q') ?? '';
  const [input, setInput] = useState(urlQuery);

  // Defer the query the results read from, so typing stays responsive while the
  // list catches up a beat later.
  const query = useDeferredValue(input);

  // The URL is the source of truth, and it can change from under us — the ⌘K
  // palette navigates to /search?q=… while this view is already mounted. Adopt
  // the incoming query, or the write-effect below would race it and put the old
  // one back.
  useEffect(() => {
    setInput((current) => (current === urlQuery ? current : urlQuery));
  }, [urlQuery]);

  // Reflect typing into the URL, without stacking history entries. The guard
  // makes the two effects converge instead of ping-ponging.
  useEffect(() => {
    if (input === urlQuery) return;
    router.replace(input ? `/search?q=${encodeURIComponent(input)}` : '/search', {
      scroll: false,
    });
  }, [input, urlQuery, router]);

  const { data, isFetching, isError, error, refetch } = useSearch(query);
  const hasQuery = query.trim().length > 0;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-heading-m text-foreground font-semibold">Search</h1>
        <p className="text-small text-muted-foreground">
          One query across everything Kloyya knows — every result opens the record
          behind it.
        </p>
      </header>

      <div className="relative">
        <SearchIcon
          aria-hidden="true"
          className="text-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search tasks, meetings, people, knowledge…"
          aria-label="Search Kloyya"
          autoFocus
          className="pl-9"
        />
      </div>

      {!hasQuery ? (
        <Card>
          <EmptyState
            icon={SearchIcon}
            title="Search across everything."
            description="Find a task, a meeting, a person, a decision — start typing above."
          />
        </Card>
      ) : isError ? (
        <Card>
          <ErrorState error={toErrorPresentation(error)} onRetry={() => void refetch()} />
        </Card>
      ) : !data && isFetching ? (
        <LoadingRegion label="Searching" className="space-y-3">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </LoadingRegion>
      ) : data && data.length === 0 ? (
        <Card>
          <EmptyState
            icon={SearchIcon}
            title={`Nothing matches “${query.trim()}”.`}
            description="Try a different term, or a person or project name."
          />
        </Card>
      ) : data ? (
        <Results results={data} />
      ) : null}
    </div>
  );
}

function Results({ results }: { results: SearchResult[] }) {
  const byKind = new Map<SearchKind, SearchResult[]>();
  for (const result of results) {
    const bucket = byKind.get(result.kind) ?? [];
    bucket.push(result);
    byKind.set(result.kind, bucket);
  }

  return (
    <div className="space-y-6">
      <p className="text-caption text-subtle" role="status">
        {results.length} {results.length === 1 ? 'result' : 'results'}
      </p>
      {SEARCH_KIND_ORDER.filter((kind) => byKind.has(kind)).map((kind) => (
        <section key={kind} aria-label={SEARCH_KIND_META[kind].group} className="space-y-2">
          <h2 className="text-caption text-muted-foreground font-medium tracking-wide uppercase">
            {SEARCH_KIND_META[kind].group}
          </h2>
          <ul className="space-y-2">
            {byKind.get(kind)!.map((result) => (
              <li key={`${result.kind}-${result.id}`}>
                <ResultRow result={result} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ResultRow({ result }: { result: SearchResult }) {
  const Icon = SEARCH_KIND_META[result.kind].icon;
  return (
    <Link href={result.href} className="group block rounded-lg">
      <Card className="group-hover:border-muted flex items-center justify-between gap-3 p-4 transition-colors">
        <span className="flex min-w-0 items-center gap-3">
          <Icon aria-hidden="true" className="text-subtle size-4 shrink-0" />
          <span className="min-w-0">
            <span className="text-body text-foreground block truncate font-medium">
              {result.title}
            </span>
            <span className="text-caption text-subtle block truncate">{result.subtitle}</span>
          </span>
        </span>
        <ArrowUpRight aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
      </Card>
    </Link>
  );
}
