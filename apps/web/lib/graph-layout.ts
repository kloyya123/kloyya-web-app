import type { GraphLayout, KnowledgeGraph, PositionedNode } from '@/types/knowledge';

/**
 * Deterministic radial layout for the knowledge graph.
 *
 * A force simulation would be non-deterministic (untestable), would re-run every
 * render, and would jitter the graph under the user's cursor. Instead this does
 * a plain BFS from the focus node and places each ring on a circle — the focus
 * at the centre, its neighbours around it, their neighbours further out. Pure and
 * stable, the same discipline as calendar-math's lane assignment: given the same
 * graph and focus, the same coordinates, every time.
 */

const DEFAULT_WIDTH = 880;
const DEFAULT_HEIGHT = 880;
const RING_GAP = 150;

export interface LayoutOptions {
  width?: number;
  height?: number;
  ringGap?: number;
}

/** Undirected adjacency — a relationship connects both ways for distance. */
function buildAdjacency(graph: KnowledgeGraph): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) adjacency.set(node.id, []);
  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.push(edge.target);
    adjacency.get(edge.target)?.push(edge.source);
  }
  return adjacency;
}

/** BFS ring (distance) for every reachable node, keyed by id. */
function ringsFromFocus(graph: KnowledgeGraph, focusId: string): Map<string, number> {
  const adjacency = buildAdjacency(graph);
  const rings = new Map<string, number>([[focusId, 0]]);
  let frontier = [focusId];

  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      const depth = rings.get(id)!;
      // Sort neighbours so traversal order — and thus layout — is stable.
      for (const neighbour of [...(adjacency.get(id) ?? [])].sort()) {
        if (!rings.has(neighbour)) {
          rings.set(neighbour, depth + 1);
          next.push(neighbour);
        }
      }
    }
    frontier = next;
  }
  return rings;
}

export function layoutRadial(
  graph: KnowledgeGraph,
  focusId: string,
  options: LayoutOptions = {},
): GraphLayout {
  if (!graph.nodes.some((node) => node.id === focusId)) {
    throw new Error(`Focus node "${focusId}" is not in the graph.`);
  }

  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const ringGap = options.ringGap ?? RING_GAP;
  const cx = width / 2;
  const cy = height / 2;

  const rings = ringsFromFocus(graph, focusId);
  const reachableMax = Math.max(0, ...rings.values());
  // Unreachable nodes still need a home — one ring past everything reachable.
  const orphanRing = reachableMax + 1;

  // Group node ids by ring, in a stable order, so angular slots are reproducible.
  const byRing = new Map<number, string[]>();
  for (const node of [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id))) {
    const ring = rings.get(node.id) ?? orphanRing;
    const bucket = byRing.get(ring) ?? [];
    bucket.push(node.id);
    byRing.set(ring, bucket);
  }

  const positionById = new Map<string, { x: number; y: number; ring: number }>();
  for (const [ring, ids] of byRing) {
    if (ring === 0) {
      // The focus sits dead centre regardless of how many share ring 0 (only it does).
      for (const id of ids) positionById.set(id, { x: cx, y: cy, ring });
      continue;
    }
    const radius = ring * ringGap;
    // Offset alternate rings by half a slot so spokes don't line up across rings.
    const offset = ring % 2 === 0 ? Math.PI / ids.length : 0;
    ids.forEach((id, index) => {
      const angle = (2 * Math.PI * index) / ids.length + offset - Math.PI / 2;
      positionById.set(id, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        ring,
      });
    });
  }

  const nodes: PositionedNode[] = graph.nodes.map((node) => {
    const pos = positionById.get(node.id)!;
    return { ...node, x: pos.x, y: pos.y, ring: pos.ring };
  });

  return { nodes, edges: graph.edges, width, height, focusId };
}
