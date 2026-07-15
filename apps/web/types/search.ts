/**
 * Cross-entity search over the one coherent dataset.
 *
 * A SearchDoc is the searchable projection of a real record — a task, meeting,
 * email, project, person, article, or recommendation. Every doc points at the
 * live surface for that record (`href`), so a result you can't open is never
 * indexed: the same "nothing without somewhere to go" rule the graph follows.
 */

export const SEARCH_KINDS = [
  'task',
  'meeting',
  'email',
  'project',
  'person',
  'article',
  'recommendation',
] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export interface SearchDoc {
  id: string;
  kind: SearchKind;
  title: string;
  /** A short qualifier — status, sender, owner. */
  subtitle: string;
  href: string;
  /** Extra searchable text that isn't shown as the title: tags, names, ids. */
  keywords: string[];
}

export interface SearchResult extends SearchDoc {
  /** Relevance, higher is better. Assigned by lib/search. */
  score: number;
}
