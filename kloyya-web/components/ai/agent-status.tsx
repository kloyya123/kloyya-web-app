'use client';

import { useReducedMotion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';
import type { Agent, AgentStatus as Status } from '@/types/domain';

/**
 * KDS AI Components: "Agent Status."
 *
 * Design Manifesto: "AI should feel alive… Never fake activity."
 *
 * So this renders only what the agent is actually doing. An idle agent looks
 * idle. There is no ambient shimmer, no perpetual "thinking" state, and nothing
 * that pulses when no work is happening — that would be exactly the fake
 * activity the Manifesto forbids.
 */

const STATUS_STYLES: Record<Status, { dot: string; label: string }> = {
  idle: { dot: 'bg-muted', label: 'Idle' },
  thinking: { dot: 'bg-executive-purple', label: 'Thinking' },
  acting: { dot: 'bg-intelligence-blue', label: 'Working' },
  blocked: { dot: 'bg-warning', label: 'Blocked' },
  failed: { dot: 'bg-danger', label: 'Failed' },
};

/** Only these two states are genuinely in-flight, and only they animate. */
const ACTIVE_STATUSES: ReadonlySet<Status> = new Set<Status>(['thinking', 'acting']);

export function AgentStatusList({ agents }: { agents: Agent[] }) {
  const active = agents.filter((agent) => ACTIVE_STATUSES.has(agent.status));

  return (
    <ul className="space-y-2.5" aria-label="Agent activity">
      {agents.map((agent) => (
        <li key={agent.kind}>
          <AgentStatusRow agent={agent} />
        </li>
      ))}

      {active.length === 0 ? (
        <li className="text-caption text-subtle">
          Nothing running. Kloyya updates when your work does.
        </li>
      ) : null}
    </ul>
  );
}

export function AgentStatusRow({ agent }: { agent: Agent }) {
  const prefersReducedMotion = useReducedMotion();
  const styles = STATUS_STYLES[agent.status];
  const isActive = ACTIVE_STATUSES.has(agent.status);

  return (
    <div className="flex items-start gap-2.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="mt-1.5 flex size-2 shrink-0 items-center justify-center">
            <span
              aria-hidden="true"
              className={cn(
                'size-2 rounded-full',
                styles.dot,
                isActive && !prefersReducedMotion && 'animate-pulse',
              )}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>{styles.label}</TooltipContent>
      </Tooltip>

      <div className="min-w-0">
        <p className="text-small text-foreground font-medium">
          {agent.displayName}
          <span className="sr-only">: {styles.label}</span>
        </p>

        {/* An idle agent says when it last ran, not what it is "doing". */}
        <p className="text-caption text-muted-foreground truncate">
          {agent.activity ?? (
            <>
              Last ran{' '}
              <time dateTime={agent.lastActiveAt}>
                {formatRelativeTime(agent.lastActiveAt)}
              </time>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
