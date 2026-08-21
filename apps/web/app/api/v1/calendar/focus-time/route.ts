import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { holdFocusTime } from '@server/calendar/service';

const body = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  minutes: z.number().int().positive(),
});

export const POST = kasRoute('verified', async (req, ctx) => {
  const slot = body.parse(await req.json());
  // holdFocusTime always throws (see server/calendar/service.ts) — there is no
  // write path to a real calendar yet. The route still exists so the client
  // gets a proper KAS error envelope rather than a 404 for a button it shows.
  const held = await holdFocusTime(slot);
  return NextResponse.json(ok(held, ctx.correlationId));
});
