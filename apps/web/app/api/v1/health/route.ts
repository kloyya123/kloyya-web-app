import { NextResponse } from 'next/server';
import { ok } from '@server/http/envelope';
import { config } from '@server/config';

const startedAt = Date.now();

/** Liveness + version probe. Unguarded, envelope-wrapped. */
export async function GET() {
  const correlationId = crypto.randomUUID();
  return NextResponse.json(
    ok(
      {
        status: 'ok',
        environment: config.NODE_ENV,
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      },
      correlationId,
    ),
  );
}
