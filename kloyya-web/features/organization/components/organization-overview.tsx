'use client';

import { Building2, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from '@/components/ui';
import { roleLabel } from '@/lib/org-roles';
import { toErrorPresentation } from '@/lib/error-presentation';
import { initials } from '@/lib/format';
import type { Organization, User, Workspace } from '@/types/domain';
import { roleTone } from '../role-meta';
import { useOrganization } from '../hooks/use-organization';

const PLAN_META: Record<Organization['plan'], { label: string; tone: 'neutral' | 'primary' | 'ai' }> = {
  starter: { label: 'Starter', tone: 'neutral' },
  growth: { label: 'Growth', tone: 'primary' },
  enterprise: { label: 'Enterprise', tone: 'ai' },
};

/**
 * The organization: who you are as a company, and everyone in it.
 *
 * The org card carries identity and the workspace's Trust Score; the directory
 * lists members most-senior-first, each a door into their profile — which is
 * where the graph's person nodes lead.
 */
export function OrganizationOverview() {
  const { data, isPending, isError, error, refetch } = useOrganization();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-heading-m text-foreground font-semibold">Organization</h1>
        <p className="text-small text-muted-foreground">
          Who Northwind is, and everyone who makes it run.
        </p>
      </header>

      {isPending ? (
        <LoadingRegion label="Loading your organization" className="space-y-6">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </LoadingRegion>
      ) : isError ? (
        <Card>
          <ErrorState error={toErrorPresentation(error)} onRetry={() => void refetch()} />
        </Card>
      ) : (
        <>
          <OrgCard
            organization={data.organization}
            workspace={data.workspace}
            memberCount={data.memberCount}
          />

          <section aria-label="People" className="space-y-3">
            <h2 className="text-title text-foreground font-semibold">People</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.members.map((member) => (
                <li key={member.id}>
                  <MemberCard member={member} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function OrgCard({
  organization,
  workspace,
  memberCount,
}: {
  organization: Organization;
  workspace: Workspace;
  memberCount: number;
}) {
  const plan = PLAN_META[organization.plan];

  return (
    <Card>
      <CardContent className="flex flex-wrap items-start justify-between gap-6 pt-6">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="bg-intelligence-blue/12 text-link flex size-12 shrink-0 items-center justify-center rounded-lg"
          >
            <Building2 className="size-6" />
          </span>
          <div className="space-y-1">
            <h2 className="text-heading-s text-foreground font-semibold">{organization.name}</h2>
            <p className="text-small text-muted-foreground">{organization.industry}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge tone={plan.tone}>{plan.label}</Badge>
              <span className="text-caption text-subtle inline-flex items-center gap-1">
                <Users aria-hidden="true" className="size-3.5" />
                {memberCount} members
              </span>
            </div>
          </div>
        </div>

        <div className="border-border bg-muted/4 flex items-center gap-3 rounded-lg border px-4 py-3">
          <ShieldCheck aria-hidden="true" className="text-positive size-5" />
          <div>
            <p className="text-heading-s text-foreground font-semibold tabular-nums">
              {workspace.trustScore}
            </p>
            <p className="text-caption text-muted-foreground">
              Trust Score · {workspace.name}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MemberCard({ member }: { member: User }) {
  return (
    <Link href={`/organization/${member.id}`} className="group block h-full rounded-lg">
      <Card className="group-hover:border-muted h-full transition-colors">
        <CardHeader className="flex-col items-stretch gap-3">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{initials(member.fullName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardTitle className="truncate">{member.fullName}</CardTitle>
              <p className="text-caption text-muted-foreground truncate">{member.jobTitle}</p>
            </div>
          </div>
          <Badge tone={roleTone(member.role)}>{roleLabel(member.role)}</Badge>
        </CardHeader>
      </Card>
    </Link>
  );
}
