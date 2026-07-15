import type { GraphNode } from '@/types/knowledge';
import { NODE_META } from '../node-meta';

/**
 * A graph node rendered inline: kind-coloured icon, a top line, and the label.
 *
 * Shared by the graph's connections panel and the article "draws on" list so the
 * icon-and-colour mapping lives once. The top line is the node's kind by default;
 * the connections panel overrides it with the relationship ("blocks", "owns").
 */
export function EntityGlyph({ node, topLine }: { node: GraphNode; topLine?: string }) {
  const meta = NODE_META[node.kind];
  const Icon = meta.icon;

  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Icon aria-hidden="true" className="size-4 shrink-0" style={{ color: meta.cssVar }} />
      <span className="min-w-0">
        <span className="text-caption text-subtle block">{topLine ?? meta.noun}</span>
        <span className="text-small text-foreground block truncate">{node.label}</span>
      </span>
    </span>
  );
}
