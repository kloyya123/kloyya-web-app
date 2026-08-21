'use client';

import { useLinkStatus } from 'next/link';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Feedback the instant a nav `Link` is clicked, not just once the next page
 * has shown up.
 *
 * A cold Vercel serverless function can take several seconds to answer its
 * first request in a while (measured: a cold `/signup` hit took 17s; warm,
 * ~1.6s). A plain `<Link>` gives zero visual response while that happens —
 * clicking it looks identical to clicking nothing, which is exactly the "the
 * button doesn't work" report this fixes. `useLinkStatus` is Next's own
 * signal for this: it flips true the moment navigation starts and back once
 * the destination has rendered, correct regardless of how long that takes.
 *
 * Must render as a child of the `Link` it reports on — that is how
 * `useLinkStatus` finds its navigation.
 */
export function NavLinkLabel({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <>
      {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
      <span className={pending ? 'opacity-70' : undefined}>{children}</span>
    </>
  );
}
