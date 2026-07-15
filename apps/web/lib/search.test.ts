import { describe, expect, it } from 'vitest';
import type { SearchDoc } from '@/types/search';
import { searchDocs, tokenize } from './search';

function doc(overrides: Partial<SearchDoc> & { id: string }): SearchDoc {
  return {
    kind: 'project',
    title: 'Title',
    subtitle: 'Subtitle',
    href: '/x',
    keywords: [],
    ...overrides,
  };
}

const docs: SearchDoc[] = [
  doc({ id: 'atlas', kind: 'project', title: 'Atlas — Warehouse Fleet v3', subtitle: 'At risk', keywords: ['fleet'] }),
  doc({ id: 'review', kind: 'meeting', title: 'Atlas milestone review', subtitle: 'Upcoming', keywords: [] }),
  doc({ id: 'daniel', kind: 'person', title: 'Daniel Reyes', subtitle: 'VP Engineering', keywords: ['atlas', 'owner'] }),
  doc({ id: 'soc2', kind: 'article', title: 'SOC 2 evidence checklist', subtitle: 'Playbook', keywords: ['security', 'harbor'] }),
];

describe('tokenize', () => {
  it('lowercases and splits on non-alphanumerics', () => {
    expect(tokenize('Atlas — Fleet_v3')).toEqual(['atlas', 'fleet', 'v3']);
  });

  it('is empty for blank input', () => {
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('searchDocs', () => {
  it('returns nothing for a blank query', () => {
    expect(searchDocs(docs, '   ')).toEqual([]);
  });

  it('matches a title token, case-insensitively', () => {
    const ids = searchDocs(docs, 'ATLAS').map((r) => r.id);
    expect(ids).toContain('atlas');
    expect(ids).toContain('review');
  });

  it('ranks a title match above a keyword-only match', () => {
    const results = searchDocs(docs, 'atlas');
    const atlas = results.find((r) => r.id === 'atlas')!;
    const daniel = results.find((r) => r.id === 'daniel')!;
    // Daniel only matches "atlas" via a keyword; the project matches in its title.
    expect(atlas.score).toBeGreaterThan(daniel.score);
  });

  it('requires every term to match (AND, not OR)', () => {
    const ids = searchDocs(docs, 'atlas milestone').map((r) => r.id);
    expect(ids).toEqual(['review']); // only the meeting has both terms
  });

  it('excludes docs that match no term', () => {
    const ids = searchDocs(docs, 'soc').map((r) => r.id);
    expect(ids).toEqual(['soc2']);
  });

  it('matches on a keyword when the title does not', () => {
    const ids = searchDocs(docs, 'harbor').map((r) => r.id);
    expect(ids).toEqual(['soc2']);
  });

  it('sorts by score descending', () => {
    const scores = searchDocs(docs, 'atlas').map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('respects the limit', () => {
    expect(searchDocs(docs, 'a', 1)).toHaveLength(1);
  });
});
