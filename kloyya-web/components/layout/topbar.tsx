'use client';

import { ChevronDown, Menu } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui';
import type { Organization, User, Workspace } from '@/types/domain';
import { CommandPaletteTrigger } from './command-palette';
import { NotificationCenter } from './notification-center';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

export interface TopBarProps {
  user: User;
  organization: Organization;
  workspace: Workspace;
  onOpenMobileNav: () => void;
}

export function TopBar({
  user,
  organization,
  workspace,
  onOpenMobileNav,
}: TopBarProps) {
  return (
    <header className="border-border bg-background/80 sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-sm lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMobileNav}
      >
        <Menu aria-hidden="true" />
        <span className="sr-only">Open navigation</span>
      </Button>

      <WorkspaceSwitcher organization={organization} workspace={workspace} />

      <div className="flex flex-1 justify-center px-2">
        <CommandPaletteTrigger />
      </div>

      <div className="flex items-center gap-1">
        <NotificationCenter />
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}

/**
 * KDS Navigation: "Workspace Switcher, Organization Switcher."
 *
 * One control, because the hierarchy is Organization → Workspace and a user
 * switching workspaces almost never wants to leave the organization. Only the
 * seeded workspace exists today; the menu says so rather than pretending.
 */
function WorkspaceSwitcher({
  organization,
  workspace,
}: {
  organization: Organization;
  workspace: Workspace;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="min-w-0 gap-2">
          <span className="min-w-0 text-left">
            <span className="text-small text-foreground block truncate font-medium">
              {organization.name}
            </span>
            <span className="text-caption text-subtle block truncate">
              {workspace.name}
            </span>
          </span>
          <ChevronDown aria-hidden="true" className="text-subtle shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-64">
        <DropdownMenuLabel>Workspaces in {organization.name}</DropdownMenuLabel>
        <DropdownMenuItem>
          {workspace.name}
          <span className="sr-only">, current workspace</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>Create a workspace</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
