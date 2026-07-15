import type { SearchDoc, SearchResult } from '@/types/search';

/**
 * Cross-entity search ranking — pure, so relevance is a tested function rather
 * than an opaque feeling.
 *
 * The rules, in priority order: a query term is worth most when it begins a word
 * in the title, less in the subtitle, less again in a keyword, with a substring
 * fallback below each. Every term must match somewhere (AND, not OR) — searching
 * "atlas review" should find the Atlas review, not everything Atlas-related.
 */

const DEFAULT_LIMIT = 20;

/** Lowercase and split on anything that isn't a letter or digit. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}

/** How strongly one term matches one doc; 0 means "not at all". */
function termScore(term: string, doc: SearchDoc): number {
  const titleTokens = tokenize(doc.title);
  const subtitleTokens = tokenize(doc.subtitle);
  const keywordTokens = tokenize(doc.keywords.join(' '));

  if (titleTokens.some((t) => t.startsWith(term))) return 3;
  if (subtitleTokens.some((t) => t.startsWith(term))) return 2;
  if (doc.title.toLowerCase().includes(term)) return 1.5;
  if (keywordTokens.some((t) => t.startsWith(term))) return 1;
  if (doc.subtitle.toLowerCase().includes(term)) return 0.8;
  if (doc.keywords.join(' ').toLowerCase().includes(term)) return 0.5;
  return 0;
}

/** Total relevance of a doc for a query, or 0 if any term fails to match. */
function scoreDoc(doc: SearchDoc, terms: string[]): number {
  let total = 0;
  for (const term of terms) {
    const score = termScore(term, doc);
    if (score === 0) return 0; // AND: one missing term disqualifies the doc.
    total += score;
  }
  return total;
}

export function searchDocs(
  docs: readonly SearchDoc[],
  query: string,
  limit: number = DEFAULT_LIMIT,
): SearchResult[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  return docs
    .map((doc) => ({ ...doc, score: scoreDoc(doc, terms) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
}
