import { NextResponse } from 'next/server';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { getGraph } from '@server/knowledge/service';

export const GET = kasRoute('verified', async (_req, ctx) => {
  // Honestly empty — see server/knowledge/service.ts's module doc for why a
  // real entity/relationship graph is follow-on work, not this pass.
  const graph = await getGraph();
  return NextResponse.json(ok(graph, ctx.correlationId));
});
