'use client';

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  LoadingRegion,
  Select,
  Skeleton,
} from '@/components/ui';
import { layoutRadial } from '@/lib/graph-layout';
import { toErrorPresentation } from '@/lib/error-presentation';
import type { Connection, GraphNode, KnowledgeGraph, PositionedNode } from '@/types/knowledge';
import { NODE_META } from '../node-meta';
import { useKnowledgeGraph } from '../hooks/use-knowledge';
import { EntityGlyph } from './entity-glyph';

const DEFAULT_FOCUS = 'proj_atlas';

/**
 * The knowledge graph: organizational memory as a shape you can walk.
 *
 * The SVG is the visual and is hidden from assistive tech — a node-and-edge
 * picture says nothing to a screen reader. The accessible, actionable equivalent
 * sits beside it: a focus selector and a connections panel of real links. Mouse
 * users click the picture to re-focus; keyboard users drive the panel. Both
 * reach every node and every entity behind it.
 */
export function KnowledgeGraphView() {
  const { data: graph, isPending, isError, error, refetch } = useKnowledgeGraph();

  if (isPending) {
    return (
      <LoadingRegion label="Building the graph">
        <Skeleton className="h-[520px] rounded-lg" />
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

  return <Graph graph={graph} />;
}

function Graph({ graph }: { graph: KnowledgeGraph }) {
  const initial = graph.nodes.some((n) => n.id === DEFAULT_FOCUS)
    ? DEFAULT_FOCUS
    : (graph.nodes[0]?.id ?? '');
  const [focusId, setFocusId] = useState(initial);

  const layout = useMemo(() => layoutRadial(graph, focusId), [graph, focusId]);
  const positionById = useMemo(
    () => new Map(layout.nodes.map((n) => [n.id, n])),
    [layout],
  );
  const focusNode = positionById.get(focusId)!;

  // Every edge touching the focus, resolved to the node on its far end.
  const connections: Connection[] = useMemo(() => {
    const result: Connection[] = [];
    for (const edge of graph.edges) {
      if (edge.source === focusId) {
        const node = positionById.get(edge.target);
        if (node) result.push({ node, relation: edge.relation, outgoing: true });
      } else if (edge.target === focusId) {
        const node = positionById.get(edge.source);
        if (node) result.push({ node, relation: edge.relation, outgoing: false });
      }
    }
    return result.sort((a, b) => a.node.label.localeCompare(b.node.label));
  }, [graph.edges, focusId, positionById]);

  const connectedIds = useMemo(
    () => new Set(connections.map((c) => c.node.id)),
    [connections],
  );

  return (
    <Card>
      <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <CardTitle as="h2">Knowledge graph</CardTitle>
          <p className="text-caption text-muted-foreground">
            How Northwind&rsquo;s work connects. Select or click a node to re-centre.
          </p>
        </div>
        <label className="sm:w-64">
          <span className="sr-only">Focus node</span>
          <Select value={focusId} onChange={(e) => setFocusId(e.target.value)}>
            {graph.nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {NODE_META[node.kind].noun}: {node.label}
              </option>
            ))}
          </Select>
        </label>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* min-w-0: a grid child defaults to min-width:auto, so without this the
            wide SVG refuses to shrink and pushes the whole page sideways on a
            phone instead of scrolling inside its own container. */}
        <div className="min-w-0 lg:col-span-3">
          <GraphCanvas
            layout={layout}
            focusId={focusId}
            connectedIds={connectedIds}
            onFocus={setFocusId}
          />
        </div>
        <aside className="min-w-0 lg:col-span-2">
          <ConnectionsPanel
            focus={focusNode}
            connections={connections}
            onFocus={setFocusId}
          />
        </aside>
      </CardContent>

      <div className="px-6 pb-6">
        <Legend />
      </div>
    </Card>
  );
}

function GraphCanvas({
  layout,
  focusId,
  connectedIds,
  onFocus,
}: {
  layout: ReturnType<typeof layoutRadial>;
  focusId: string;
  connectedIds: Set<string>;
  onFocus: (id: string) => void;
}) {
  return (
    // Decorative: the panel beside it carries the same information accessibly.
    <div className="border-border bg-muted/4 overflow-auto rounded-lg border">
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="mx-auto block h-auto w-full min-w-[520px]"
      >
        {layout.edges.map((edge) => {
          const a = layout.nodes.find((n) => n.id === edge.source);
          const b = layout.nodes.find((n) => n.id === edge.target);
          if (!a || !b) return null;
          const touchesFocus = edge.source === focusId || edge.target === focusId;
          return (
            <line
              key={edge.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={touchesFocus ? 'var(--color-intelligence-blue)' : 'var(--color-border)'}
              strokeWidth={touchesFocus ? 2 : 1}
              strokeOpacity={touchesFocus ? 0.8 : 0.5}
            />
          );
        })}

        {layout.nodes.map((node) => (
          <GraphNodeMark
            key={node.id}
            node={node}
            isFocus={node.id === focusId}
            isConnected={connectedIds.has(node.id)}
            onFocus={onFocus}
          />
        ))}
      </svg>
    </div>
  );
}

function truncate(label: string, max = 22): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function GraphNodeMark({
  node,
  isFocus,
  isConnected,
  onFocus,
}: {
  node: PositionedNode;
  isFocus: boolean;
  isConnected: boolean;
  onFocus: (id: string) => void;
}) {
  const meta = NODE_META[node.kind];
  const radius = isFocus ? 30 : 20;
  // Dim nodes that are neither the focus nor directly connected to it.
  const dim = !isFocus && !isConnected;

  return (
    <g
      transform={`translate(${node.x} ${node.y})`}
      className="cursor-pointer"
      onClick={() => onFocus(node.id)}
      opacity={dim ? 0.45 : 1}
    >
      <circle
        r={radius}
        fill={meta.cssVar}
        fillOpacity={isFocus ? 0.28 : 0.16}
        stroke={meta.cssVar}
        strokeWidth={isFocus ? 3 : 2}
      />
      <text
        textAnchor="middle"
        dy={radius + 18}
        fill="var(--color-foreground)"
        style={{ fontSize: isFocus ? 15 : 13, fontWeight: isFocus ? 600 : 500 }}
      >
        {truncate(node.label)}
      </text>
    </g>
  );
}

function ConnectionsPanel({
  focus,
  connections,
  onFocus,
}: {
  focus: GraphNode;
  connections: Connection[];
  onFocus: (id: string) => void;
}) {
  const FocusIcon = NODE_META[focus.kind].icon;

  return (
    <div className="space-y-4">
      <div className="border-border rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: NODE_META[focus.kind].cssVar, opacity: 0.9 }}
          >
            <FocusIcon className="size-4 text-white" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <p className="text-caption text-subtle">{NODE_META[focus.kind].noun}</p>
            <p className="text-body text-foreground font-semibold">{focus.label}</p>
            {focus.sublabel ? (
              <p className="text-caption text-muted-foreground">{focus.sublabel}</p>
            ) : null}
          </div>
        </div>
        {focus.entityHref ? (
          <Link
            href={focus.entityHref}
            className="text-caption text-link mt-3 inline-flex items-center gap-1 rounded-sm font-medium"
          >
            Open
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </Link>
        ) : null}
      </div>

      <div>
        <h3 className="text-caption text-muted-foreground mb-2 font-medium tracking-wide uppercase">
          {connections.length} {connections.length === 1 ? 'connection' : 'connections'}
        </h3>
        <ul className="space-y-1.5">
          {connections.map((connection) => {
            return (
              <li
                key={`${connection.node.id}-${connection.relation}`}
                className="border-border hover:bg-hover flex items-center gap-2 rounded-md border p-2.5"
              >
                <button
                  type="button"
                  onClick={() => onFocus(connection.node.id)}
                  className="flex min-w-0 flex-1 items-center rounded-sm text-left"
                  aria-label={`Focus ${connection.node.label}`}
                >
                  <EntityGlyph
                    node={connection.node}
                    topLine={
                      connection.outgoing ? connection.relation : `${connection.relation} ←`
                    }
                  />
                </button>
                {connection.node.entityHref ? (
                  <Link
                    href={connection.node.entityHref}
                    className="text-muted-foreground hover:text-foreground shrink-0 rounded-sm p-1"
                    aria-label={`Open ${connection.node.label}`}
                  >
                    <ArrowUpRight aria-hidden="true" className="size-4" />
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2">
      {Object.entries(NODE_META).map(([kind, meta]) => (
        <li key={kind} className="text-caption text-muted-foreground flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full"
            style={{ backgroundColor: meta.cssVar }}
          />
          {meta.noun}
        </li>
      ))}
    </ul>
  );
}
