import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { connections } from '@kloyya/db/schema';
import { config } from '@server/config';
import { getDeps } from '@server/deps';
import { landRecords, type RecordToLand } from '@server/integrations/sync';
import { SLACK_TEAM_ID_KEY } from '@server/integrations/slack';
import type { RawSlackMessage } from '@server/integrations/slack-client';
import { validateSlackMessages } from '@server/integrations/validation';
import type { StartContext } from '@server/tenant';

/**
 * Slack's Events API — live messages, not the once-a-day poll `sync.ts` runs.
 *
 * Deliberately NOT session-guarded, the same reasoning as the OAuth callback:
 * Slack calls this directly, with no Kloyya session to present. What proves
 * the request is genuine is the signature, verified below against
 * SLACK_SIGNING_SECRET — never the request body alone, which anyone can copy.
 *
 * Slack expects a response inside 3 seconds, and retries on anything else — so
 * once a request is verified as genuinely from Slack, this returns 200 even if
 * landing the message fails internally (logged, not retried into a storm). Only
 * a request that FAILS verification is refused outright.
 */

const MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60;

/**
 * Slack's HMAC scheme: sign `v0:{timestamp}:{raw body}` with the signing
 * secret, compare against the `v0=...` the request carries. Must run against
 * the exact raw bytes Slack sent — re-serializing parsed JSON before verifying
 * would sign different bytes than Slack did and reject every real request.
 */
export function isGenuineSlackRequest(params: {
  signingSecret: string;
  timestampHeader: string | null;
  signatureHeader: string | null;
  rawBody: string;
}): boolean {
  const { signingSecret, timestampHeader, signatureHeader, rawBody } = params;
  if (!timestampHeader || !signatureHeader) return false;

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) return false;
  // A signed request from five minutes ago is a replay, not a late delivery.
  if (Math.abs(Date.now() / 1000 - timestamp) > MAX_TIMESTAMP_SKEW_SECONDS) return false;

  const expected = `v0=${createHmac('sha256', signingSecret).update(`v0:${timestampHeader}:${rawBody}`).digest('hex')}`;
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  // Constant-time compare: an early-exit string compare would leak how many
  // leading bytes matched, which is exactly what a timing attack measures.
  return expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
}

interface SlackEventEnvelope {
  type?: string;
  challenge?: string;
  team_id?: string;
  event?: RawSlackMessage & { channel?: string; channel_type?: string };
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!config.SLACK_SIGNING_SECRET) {
    // Unconfigured, not broken — same distinction the OAuth routes make.
    return NextResponse.json({ error: 'slack_events_unconfigured' }, { status: 503 });
  }

  const rawBody = await req.text();
  const genuine = isGenuineSlackRequest({
    signingSecret: config.SLACK_SIGNING_SECRET,
    timestampHeader: req.headers.get('x-slack-request-timestamp'),
    signatureHeader: req.headers.get('x-slack-signature'),
    rawBody,
  });
  if (!genuine) return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });

  let body: SlackEventEnvelope;
  try {
    body = JSON.parse(rawBody) as SlackEventEnvelope;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Slack's one-time handshake when the Request URL is first saved: echo the
  // challenge back verbatim, unsigned response, nothing else to do.
  if (body.type === 'url_verification') {
    return NextResponse.json({ challenge: body.challenge });
  }

  if (body.type !== 'event_callback' || !body.event || body.event.type !== 'message' || !body.team_id) {
    // Acknowledged, not processed — an event type this route doesn't act on
    // yet (reactions, app mentions, …) is not an error.
    return NextResponse.json({ ok: true });
  }

  try {
    await landLiveMessage(body.team_id, body.event);
  } catch (error) {
    // Verified as genuinely from Slack, so acknowledge it — a 500 here just
    // earns a retry storm for a failure that will fail identically each time.
    console.error('[slack-events] failed to land a live message', error);
  }

  return NextResponse.json({ ok: true });
}

export async function landLiveMessage(
  teamId: string,
  event: RawSlackMessage & { channel?: string },
): Promise<void> {
  // A channel-join, edit notice, etc. is Slack bookkeeping — the same filter
  // the scheduled sync applies, kept identical so a message reads the same way
  // regardless of which path landed it.
  if (event.subtype) return;
  if (!event.channel) return;

  const batch = validateSlackMessages([event]);
  if (batch.valid.length === 0) return;

  const { db } = await getDeps();

  // Cross-tenant lookup: an incoming event carries Slack's team id, not a
  // Kloyya workspace id, so there is no tenant to scope this query to yet —
  // it exists to FIND the tenant. Selects coordinates only, same reasoning as
  // the scheduler's own unscoped enumeration (see sync/scheduler.ts). Every
  // write below re-enters through landRecords, which opens its own
  // withTenantScope.
  const matches = await db
    .select({
      id: connections.id,
      organizationId: connections.organizationId,
      workspaceId: connections.workspaceId,
      connectedByUserId: connections.connectedByUserId,
    })
    .from(connections)
    .where(
      and(
        eq(connections.integrationId, 'slack'),
        eq(connections.status, 'connected'),
        sql`${connections.syncCursors} ->> ${SLACK_TEAM_ID_KEY} = ${teamId}`,
      ),
    );

  const record: RecordToLand = {
    resourceType: 'slack_message',
    externalId: `${event.channel}:${event.ts}`,
    // Channel name isn't on the event itself; the next scheduled sync fills it
    // in when it re-lands the same externalId (landRecords upserts by id, so
    // this is a normal overwrite, not a special case).
    payload: { ...event, channelId: event.channel, channelName: null },
    cancelled: false,
  };

  for (const match of matches) {
    const ctx: StartContext = {
      organizationId: match.organizationId,
      workspaceId: match.workspaceId,
      userId: match.connectedByUserId ?? '',
    };
    await landRecords(db, ctx, match.id, 'slack', [record], new Date());
  }
}
