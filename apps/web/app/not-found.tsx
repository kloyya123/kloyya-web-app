import { Compass } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { Button, Card, CardContent, EmptyState } from '@/components/ui';

/**
 * KDS: "Every error should include: Clear explanation, Recovery steps, Retry
 * action, Support reference." Next's default 404 is an unstyled black page with
 * none of those, and it is the one screen a lost user is guaranteed to see.
 *
 * Copy follows the Manifesto's rule that errors "never blame the user": the
 * page is missing, the user is not wrong.
 */
export default function NotFound() {
  return (
    <div className="bg-background flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <main id="main" className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Compass}
              title="This page doesn't exist."
              description="The link may be out of date, or the page may have moved. Your workspace is still where you left it."
              action={
                <Button asChild>
                  <Link href="/dashboard">Back to your dashboard</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
