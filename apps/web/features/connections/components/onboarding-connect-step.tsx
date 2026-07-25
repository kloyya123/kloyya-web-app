'use client';

import { ArrowRight, PlugZap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import {
  Button,
  Card,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from '@/components/ui';
import { toErrorPresentation } from '@/lib/error-presentation';
import { useConnections } from '@/hooks/use-integrations';
import { isConnected, type IntegrationConnection } from '@/types/integrations';
import { IntegrationCard } from './integration-card';

/**
 * The pre-workspace connection step: Signup → Connect tools → Create workspace.
 *
 * A curated slice of the full catalogue, shown once, before the workspace
 * exists — so Kloyya initializes with real context from day one instead of an
 * empty shell. Deliberately not the whole Connection Manager: eleven familiar
 * tools in four groups, because a new user staring at fifty integrations is a
 * new user who clicks Skip. The full catalogue stays one click away at
 * /connections for the rest of the product's life.
 *
 * Everything behind each card is reused: the same IntegrationCard, the same
 * OAuth-shaped ConnectDialog with its permission review, the same integrations
 * service — so a tool connected here is already connected when the Connection
 * Manager and the dashboard's sources widget look. Skipping is a first-class
 * path, not a dark pattern: the workspace works without connections, it just
 * starts smarter with them.
 */

/** The onboarding tools: 5 real, connectable integrations. Order is display order. */
const CURATED_GROUPS: ReadonlyArray<{ label: string; ids: readonly string[] }> = [
  { label: 'Communication', ids: ['gmail', 'slack'] },
  { label: 'Calendar', ids: ['google_calendar'] },
  { label: 'Documents', ids: ['google_drive', 'notion'] },
];

export function OnboardingConnectStep() {
  const router = useRouter();
  const { data, isPending, isError, error, refetch } = useConnections();

  const groups = useMemo(() => {
    const byId = new Map<string, IntegrationConnection>(
      (data ?? []).map((connection) => [connection.definition.id, connection]),
    );
    return CURATED_GROUPS.map((group) => ({
      label: group.label,
      items: group.ids
        .map((id) => byId.get(id))
        .filter((c): c is IntegrationConnection => c !== undefined),
    })).filter((group) => group.items.length > 0);
  }, [data]);

  const connectedCount = useMemo(
    () => groups.flatMap((g) => g.items).filter(isConnected).length,
    [groups],
  );

  function continueToWorkspace() {
    // Tools are the last step before the workspace is built. The connections made
    // here become the context that the first sync runs against.
    router.replace('/workspace-init');
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <h1 className="text-heading-m text-foreground font-semibold">
          Connect your tools
        </h1>
        <p className="text-small text-muted-foreground mx-auto max-w-md">
          Bring your work into Kloyya. Connect the tools you already use so your
          AI Chief of Staff can understand your workflow.
        </p>
        {connectedCount > 0 ? (
          <p className="text-caption text-positive inline-flex items-center gap-1.5" role="status">
            <PlugZap aria-hidden="true" className="size-3.5" />
            {connectedCount} {connectedCount === 1 ? 'tool' : 'tools'} connected —
            your workspace will start with this context.
          </p>
        ) : null}
      </header>

      {isPending ? (
        <LoadingRegion label="Loading the tool catalogue" className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-lg" />
          ))}
        </LoadingRegion>
      ) : isError ? (
        <Card>
          <ErrorState error={toErrorPresentation(error)} onRetry={() => void refetch()} />
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.label} aria-labelledby={`connect-${group.label}`}>
              <h2
                id={`connect-${group.label}`}
                className="text-title text-foreground mb-3 font-semibold"
              >
                {group.label}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {group.items.map((connection) => (
                  <IntegrationCard key={connection.definition.id} connection={connection} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <footer className="flex flex-col items-center gap-3 pt-2">
        <Button
          size="lg"
          onClick={continueToWorkspace}
          trailingIcon={<ArrowRight aria-hidden="true" />}
        >
          Continue
        </Button>
        {connectedCount === 0 ? (
          <button
            type="button"
            onClick={continueToWorkspace}
            className="text-caption text-muted-foreground hover:text-foreground rounded-sm"
          >
            Skip and continue — you can connect tools any time
          </button>
        ) : null}
      </footer>
    </div>
  );
}
