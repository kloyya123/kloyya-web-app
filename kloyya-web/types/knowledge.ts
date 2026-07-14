import type { KnowledgeArticle, Score } from './domain';

/**
 * The knowledge graph — organizational memory, made inspectable.
 *
 * Node kinds are the union of the entity types the specs name across KARE,
 * KOMGA, and DIE. Every node points back at a real record (`entityHref`), so the
 * graph is never decorative: a node you can't open would be a claim without
 * evidence, which the product forbids.
 */

export const GRAPH_NODE_KINDS = [
  'person',
  'project',
  'meeting',
  'email',
  'task',
  'decision',
  'organization',
] as const;
export type GraphNodeKind = (typeof GRAPH_NODE_KINDS)[number];

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  /** A short qualifier — role, status, date — shown under the label. */
  sublabel?: string;
  /** Where opening this node leads. Null for a concept with no page of its own. */
  entityHref: string | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  /** The relationship, read source→target: "owns", "attended", "blocks". */
  relation: string;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * A full article. The list carries the summary; the body is fetched on open, the
 * same list-plus-detail split as meetings and mail. `relatedNodeIds` link an
 * article back into the graph so a decision record and its context stay tied.
 */
export interface ArticleDetail extends KnowledgeArticle {
  body: string;
  relatedNodeIds: string[];
}

export interface ArticleFilter {
  category?: string;
  tag?: string;
}

export interface ArticleList {
  articles: KnowledgeArticle[];
  /** Every category present, for the filter control. */
  categories: string[];
  /** Confidence-weighted view isn't needed here; raw count suffices. */
  totalCount: number;
}

/** One graph node with a resolved position, produced by the pure layout. */
export interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  /** BFS distance from the focus node. 0 is the focus itself. */
  ring: number;
}

export interface GraphLayout {
  nodes: PositionedNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  focusId: string;
}

/** A relationship resolved to the node on its far end, for the connections panel. */
export interface Connection {
  node: GraphNode;
  relation: string;
  /** True when the focus node is the edge source (relation reads focus→node). */
  outgoing: boolean;
}

export type ArticleConfidence = Score;
