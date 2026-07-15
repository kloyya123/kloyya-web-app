'use client';

import { AgentStatusList } from '@/components/ai';
import type { Agent } from '@/types/domain';
import { SidebarCard } from './dashboard';

/**
 * KAIA: Kloyya is a coordinated team of specialist agents, not one model.
 *
 * Showing them is a trust affordance, not a technical flourish — the user can
 * see which agent produced which recommendation, and whether anything is
 * currently reconsidering its advice.
 */
export function AgentActivityCard({ agents }: { agents: Agent[] }) {
  return (
    <SidebarCard title="Kloyya is working on">
      <AgentStatusList agents={agents} />
    </SidebarCard>
  );
}
