'use client';

import { ArrowLeft, Check, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { CONTACT_EMAIL } from '../content';

/**
 * The holding page for an account that is not on the private-beta allowlist.
 *
 * The tone matters here. Someone has just signed up, given us an address, and
 * been told no — the page owes them a plain reason, their place in the queue,
 * and a way out. It does not apologise at length, and it does not pretend the
 * account is broken: it works, the product is simply not open yet.
 *
 * Their address is already on file (they created an account with it), so there
 * is no second form to fill in. Saying so is more honest than a "join the
 * waitlist" input that would quietly discard a different address than the one
 * we would actually contact.
 */
export function BetaWall() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const email = session?.user.email;

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut();
      router.replace('/');
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="bg-background text-foreground flex min-h-dvh flex-col">
      <header className="border-border border-b">
        <div className="mx-auto flex max-w-content items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2.5 rounded-sm">
            <LogoMark decorative className="size-7" />
            <span className="text-title font-semibold tracking-tight">Kloyya</span>
          </Link>
          <Link
            href="/"
            className="text-caption text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-sm font-mono tracking-wider uppercase"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            Back to site
          </Link>
        </div>
      </header>

      <main id="main" className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg">
          <span className="text-caption text-link bg-intelligence-blue/10 mb-6 inline-block rounded-sm px-2.5 py-1 font-mono tracking-widest uppercase">
            Private beta
          </span>

          <h1 className="text-heading-l font-semibold tracking-tight text-balance">
            Kloyya isn’t open yet.
          </h1>

          <p className="text-muted-foreground mt-4">
            We’re testing with a small group while the connectors settle. Your account is
            created and waiting — we’ll email you the moment we let more people in.
          </p>

          {email ? (
            <div className="border-border bg-surface mt-6 flex items-start gap-3 rounded-md border p-4">
              <Mail aria-hidden="true" className="text-link mt-0.5 size-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-small text-foreground font-medium">You’re on the list</p>
                <p className="text-caption text-muted-foreground mt-0.5 font-mono break-all">
                  {email}
                </p>
              </div>
              <Check aria-hidden="true" className="text-positive ml-auto size-4 shrink-0" />
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/">Read about Kloyya</Link>
            </Button>
            <Button
              variant="ghost"
              onClick={() => void handleSignOut()}
              isLoading={isSigningOut}
              loadingLabel="Signing out"
            >
              Sign out
            </Button>
          </div>

          <p className="text-caption text-subtle mt-8 font-mono">
            Think you should have access?{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-link rounded-sm hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
