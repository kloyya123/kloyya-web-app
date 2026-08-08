'use client';

import { Command } from 'cmdk';
import { ArrowRight, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui';
import { SEARCH_KIND_META } from '@/components/search/search-meta';
import { useCommandPalette } from '@/hooks/use-command-palette';
import { useSearch } from '@/hooks/use-search';
import { cn } from '@/lib/cn';
import { NAV_ITEMS } from './nav-items';

/**
 * ⌘K / Ctrl+K.
 *
 * Two things at once: jump to a section, and search the workspace. Navigation is
 * instant (it's a static list); entity results stream in from the search service
 * as you type. It deliberately shows nothing it cannot open — every result and
 * every nav item goes somewhere real.
 *
 * cmdk's built-in filtering is turned off (`shouldFilter={false}`): the search
 * service already ranks entity hits, and nav items are filtered by hand, so cmdk
 * is left to do only what it's best at — roving focus and `aria-selected`.
 * Radix Dialog owns the focus trap and Escape.
 */
const ITEM_CLASS = cn(
  'flex cursor-default items-center gap-3 rounded-sm px-3 py-2.5',
  'text-small text-foreground',
  'data-[selected=true]:bg-hover',
);

export function CommandPalette() {
  const router = useRouter();
  const { isOpen, setOpen, toggle, close } = useCommandPalette();
  const [query, setQuery] = useState('');

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'k' || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      toggle();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  // A fresh box each time it opens.
  useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen]);

  function go(href: string) {
    close();
    router.push(href);
  }

  // The palette shows the top few hits; "See all results" opens the full page.
  const { data: results } = useSearch(query, 6);
  const trimmed = query.trim();

  const available = NAV_ITEMS.filter((item) => !item.isComingSoon);
  const navMatches = trimmed
    ? available.filter((item) => item.label.toLowerCase().includes(trimmed.toLowerCase()))
    : available;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent size="md" hideCloseButton className="overflow-hidden p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search and jump to anywhere in Kloyya.
        </DialogDescription>

        <Command
          loop
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:text-subtle [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2"
        >
          <div className="border-border flex items-center gap-2 border-b px-4">
            <Search aria-hidden="true" className="text-subtle size-4 shrink-0" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search Kloyya…"
              className="text-body text-foreground placeholder:text-subtle h-12 w-full bg-transparent outline-none"
            />
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="text-small text-subtle px-3 py-6 text-center">
              Nothing matches “{trimmed}”.
            </Command.Empty>

            {navMatches.length > 0 ? (
              <Command.Group heading="Go to">
                {navMatches.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.href}
                      value={`nav:${item.href}`}
                      onSelect={() => go(item.href)}
                      className={ITEM_CLASS}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      {item.label}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ) : null}

            {trimmed && results && results.length > 0 ? (
              <Command.Group heading="Results">
                {results.map((result) => {
                  const Icon = SEARCH_KIND_META[result.kind].icon;
                  return (
                    <Command.Item
                      key={`${result.kind}:${result.id}`}
                      value={`result:${result.kind}:${result.id}`}
                      onSelect={() => go(result.href)}
                      className={ITEM_CLASS}
                    >
                      <Icon aria-hidden="true" className="text-subtle size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{result.title}</span>
                      <span className="text-caption text-subtle shrink-0">
                        {SEARCH_KIND_META[result.kind].group}
                      </span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ) : null}

            {trimmed ? (
              <Command.Item
                value="see-all"
                onSelect={() => go(`/search?q=${encodeURIComponent(trimmed)}`)}
                className={cn(ITEM_CLASS, 'text-link')}
              >
                <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                See all results for “{trimmed}”
              </Command.Item>
            ) : null}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/** The button in the top bar that opens the palette. Also announces the shortcut. */
export function CommandPaletteTrigger() {
  const open = useCommandPalette((state) => state.open);

  return (
    <button
      type="button"
      onClick={open}
      data-tour="search"
      className={cn(
        'bg-surface border-border text-subtle flex h-9 items-center gap-2 rounded-sm border px-3',
        'hover:border-muted hover:text-foreground transition-colors duration-150',
        'w-full max-w-64',
      )}
    >
      <Search aria-hidden="true" className="size-4 shrink-0" />
      <span className="text-small flex-1 text-left">Search</span>
      <kbd className="text-caption border-border rounded-[4px] border px-1.5 py-0.5 font-sans">
        ⌘K
      </kbd>
    </button>
  );
}
