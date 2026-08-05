import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { Briefing } from '@kloyya/core';
import { Card, CardContent } from '@/components/ui';
import { formatRelativeTime } from '@/lib/format';

/**
 * The homepage's lead element — what actually happened, before anything else.
 *
 * `generateBriefing` (server/briefing/service.ts) has always produced this;
 * until now nothing on the dashboard rendered it, so a real, evidence-backed
 * account of the last day sat in the payload unseen while Ask Kloyya occupied
 * the prime position instead. This card is why that data existed at all.
 *
 * Null is a real, honest state — no evidence, no AI provider, or a model
 * failure — never papered over with invented content. See the confidence
 * number's own doc comment in briefing/service.ts: it is measured from how
 * much of the workspace the briefing actually saw, not asked of the model.
 */
export function TodaysBriefCard({ briefing }: { briefing: Briefing | null }) {
  if (!briefing) {
    return (
      <Card>
        <CardContent className="flex items-start gap-3 py-6">
          <Sparkles aria-hidden="true" className="text-ai mt-0.5 size-5 shrink-0" />
          <div className="space-y-1">
            <p className="text-title text-foreground font-semibold">Nothing to report yet</p>
            <p className="text-small text-muted-foreground">
              Kloyya writes today’s brief from what landed in your connected tools overnight.{' '}
              <Link href="/connections" className="text-link hover:underline">
                Connect a tool
              </Link>{' '}
              and it will have something to say tomorrow.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-2 py-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-caption text-ai inline-flex items-center gap-1.5 font-semibold tracking-wide uppercase">
            <Sparkles aria-hidden="true" className="size-3.5" />
            Today’s brief
          </span>
          <span className="text-caption text-subtle">{formatRelativeTime(briefing.generatedAt)}</span>
        </div>
        <p className="text-title text-foreground font-semibold text-balance">{briefing.headline}</p>
        <p className="text-small text-muted-foreground">{briefing.narrative}</p>
      </CardContent>
    </Card>
  );
}
