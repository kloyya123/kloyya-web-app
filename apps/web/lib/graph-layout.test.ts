import { describe, expect, it } from 'vitest';
import type { GraphNode, KnowledgeGraph } from '@/types/knowledge';
import { layoutRadial } from './graph-layout';

function node(id: string): GraphNode {
  return { id, kind: 'project', label: id, entityHref: null };
}

/**
 * focus — a — b   (a chain) plus an isolated island node with no edges.
 */
const graph: KnowledgeGraph = {
  nodes: [node('focus'), node('a'), node('b'), node('island')],
  edges: [
    { id: 'e1', source: 'focus', target: 'a', relation: 'r' },
    { id: 'e2', source: 'a', target: 'b', relation: 'r' },
  ],
};

describe('layoutRadial', () => {
  it('places the focus node at the centre on ring 0', () => {
    const { nodes, width, height, focusId } = layoutRadial(graph, 'focus');
    const focus = nodes.find((n) => n.id === 'focus')!;
    expect(focus.ring).toBe(0);
    expect(focus.x).toBeCloseTo(width / 2);
    expect(focus.y).toBeCloseTo(height / 2);
    expect(focusId).toBe('focus');
  });

  it('rings nodes by graph distance from the focus', () => {
    const { nodes } = layoutRadial(graph, 'focus');
    const ring = (id: string) => nodes.find((n) => n.id === id)!.ring;
    expect(ring('a')).toBe(1);
    expect(ring('b')).toBe(2);
  });

  it('treats edges as undirected when computing distance', () => {
    // Focus on 'b': the chain b—a—focus should ring a=1, focus=2.
    const { nodes } = layoutRadial(graph, 'b');
    const ring = (id: string) => nodes.find((n) => n.id === id)!.ring;
    expect(ring('a')).toBe(1);
    expect(ring('focus')).toBe(2);
  });

  it('pushes unreachable nodes to a ring beyond every reachable one', () => {
    const { nodes } = layoutRadial(graph, 'focus');
    const island = nodes.find((n) => n.id === 'island')!;
    const reachableMax = Math.max(
      ...nodes.filter((n) => n.id !== 'island').map((n) => n.ring),
    );
    expect(island.ring).toBeGreaterThan(reachableMax);
  });

  it('positions every node exactly once', () => {
    const { nodes } = layoutRadial(graph, 'focus');
    expect(nodes).toHaveLength(graph.nodes.length);
    expect(new Set(nodes.map((n) => n.id)).size).toBe(graph.nodes.length);
  });

  it('never stacks two nodes on the same point', () => {
    const { nodes } = layoutRadial(graph, 'focus');
    const points = nodes.map((n) => `${Math.round(n.x)},${Math.round(n.y)}`);
    expect(new Set(points).size).toBe(points.length);
  });

  it('is deterministic — same input, identical output', () => {
    const a = layoutRadial(graph, 'focus');
    const b = layoutRadial(graph, 'focus');
    expect(a.nodes).toEqual(b.nodes);
  });

  it('passes edges through untouched', () => {
    const { edges } = layoutRadial(graph, 'focus');
    expect(edges).toEqual(graph.edges);
  });

  it('throws when the focus id is not in the graph', () => {
    expect(() => layoutRadial(graph, 'ghost')).toThrow();
  });
});
