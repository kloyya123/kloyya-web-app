'use client';

import { Check, Loader2, ShieldCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Progress,
  toast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { useConnectionAction } from '@/hooks/use-integrations';
import type { IntegrationConnection } from '@/types/integrations';
import { FormError } from '@/features/auth/components/form-error';
import { SYNC_STAGES } from '../integration-meta';

type Phase = 'review' | 'syncing' | 'done';

export interface ConnectDialogProps {
  connection: IntegrationConnection;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The connect flow: permission review (Step 4) then live initial sync (Step 5).
 *
 * The spec makes the review mandatory — "Explain exactly what Kloyya will
 * access. Transparency is mandatory." — so a user cannot connect without first
 * seeing both what is granted and what is explicitly withheld. Only after they
 * confirm does the sync begin.
 */
export function ConnectDialog({ connection, isOpen, onOpenChange }: ConnectDialogProps) {
  const { definition } = connection;
  const action = useConnectionAction();

  const [phase, setPhase] = useState<Phase>('review');
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Reset to a clean review each time the dialog reopens.
  useEffect(() => {
    if (isOpen) {
      setPhase('review');
      setStageIndex(0);
      setError(null);
    }
  }, [isOpen]);

  // Clear any pending stage timers on unmount, so a closed dialog cannot tick.
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  async function onConfirm() {
    setError(null);
    setPhase('syncing');
    setStageIndex(0);

    // The staged progress is cosmetic — it visualizes what a real first sync
    // does. The actual state change is the connect() call; we settle on whichever
    // finishes last, so the bar never claims "done" before the mutation resolves.
    const perStage = 420;
    SYNC_STAGES.forEach((_stage, index) => {
      timers.current.push(
        setTimeout(() => setStageIndex(index + 1), perStage * (index + 1)),
      );
    });
    const animation = new Promise<void>((resolve) =>
      timers.current.push(setTimeout(resolve, perStage * SYNC_STAGES.length)),
    );

    try {
      await Promise.all([action.mutateAsync({ action: 'connect', id: definition.id }), animation]);
      setStageIndex(SYNC_STAGES.length);
      setPhase('done');
      toast.success(`${definition.name} connected.`);
    } catch (caught) {
      setError(caught);
      setPhase('review');
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            {phase === 'done' ? `${definition.name} connected` : `Connect ${definition.name}`}
          </DialogTitle>
          <DialogDescription>
            {phase === 'review'
              ? 'Review what Kloyya will and will not access before connecting.'
              : phase === 'syncing'
                ? 'Kloyya is reading and indexing your data. This runs once.'
                : `Kloyya now understands your ${definition.name} data.`}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {phase === 'review' ? (
            <PermissionReview connection={connection} error={error} />
          ) : (
            <SyncProgress stageIndex={stageIndex} />
          )}
        </DialogBody>

        <DialogFooter>
          {phase === 'review' ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                isLoading={action.isPending}
                loadingLabel={`Connecting ${definition.name}`}
                leadingIcon={<ShieldCheck aria-hidden="true" />}
              >
                Connect {definition.name}
              </Button>
            </>
          ) : phase === 'done' ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PermissionReview({
  connection,
  error,
}: {
  connection: IntegrationConnection;
  error: unknown;
}) {
  const { permissions, estimatedSyncMinutes } = connection.definition;

  return (
    <div className="space-y-4">
      {error ? <FormError error={error} /> : null}

      <div>
        <h3 className="text-caption text-subtle mb-2 font-medium tracking-wide uppercase">
          Kloyya will
        </h3>
        <ul className="space-y-1.5">
          {permissions.granted.map((scope) => (
            <li key={scope} className="text-small text-foreground flex items-center gap-2">
              <Check aria-hidden="true" className="text-positive size-4 shrink-0" />
              {scope}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-caption text-subtle mb-2 font-medium tracking-wide uppercase">
          Kloyya will never
        </h3>
        <ul className="space-y-1.5">
          {permissions.notGranted.map((scope) => (
            <li key={scope} className="text-small text-muted-foreground flex items-center gap-2">
              <X aria-hidden="true" className="text-critical size-4 shrink-0" />
              {scope}
            </li>
          ))}
        </ul>
      </div>

      {estimatedSyncMinutes > 0 ? (
        <p className="text-caption text-subtle border-border border-t pt-3">
          First sync takes about {estimatedSyncMinutes} minute
          {estimatedSyncMinutes === 1 ? '' : 's'}. You can keep working while it runs.
        </p>
      ) : null}
    </div>
  );
}

function SyncProgress({ stageIndex }: { stageIndex: number }) {
  const total = SYNC_STAGES.length;
  const percent = (Math.min(stageIndex, total) / total) * 100;
  const currentLabel = SYNC_STAGES[Math.min(stageIndex, total - 1)] ?? 'Finishing';

  return (
    <div className="space-y-4">
      <Progress value={percent} label={`Syncing: ${currentLabel}`} />
      <ol className="space-y-2.5" aria-live="polite">
        {SYNC_STAGES.map((stage, index) => {
          const status = index < stageIndex ? 'done' : index === stageIndex ? 'active' : 'pending';
          return (
            <li key={stage} className="flex items-center gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center">
                {status === 'done' ? (
                  <span className="bg-success/15 text-positive flex size-5 items-center justify-center rounded-full">
                    <Check aria-hidden="true" className="size-3" />
                  </span>
                ) : status === 'active' ? (
                  <Loader2 aria-hidden="true" className="text-link size-4 animate-spin" />
                ) : (
                  <span aria-hidden="true" className="border-border size-2 rounded-full border-2" />
                )}
              </span>
              <span
                className={cn(
                  'text-small',
                  status === 'pending' && 'text-subtle',
                  status === 'active' && 'text-foreground font-medium',
                  status === 'done' && 'text-muted-foreground',
                )}
              >
                {stage}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
