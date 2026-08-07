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
import type { User, Workspace } from '@/types/domain';
import { CommandPaletteTrigger } from './command-palette';
import { NotificationCenter } from './notification-center';
import { UserMenu } from './user-menu';

export interface TopBarProps {
  user: User;
  workspace: Workspace;
  onOpenMobileNav: () => void;
}

export function TopBar({
  user,
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

      <WorkspaceSwitcher workspace={workspace} />

      <div className="flex flex-1 justify-center px-2">
        <CommandPaletteTrigger />
      </div>

      <div className="flex items-center gap-1">
        <NotificationCenter />
        <UserMenu user={user} />
      </div>
    </header>
  );
}

/**
 * The workspace label.
 *
 * Organizations are removed from the product surface for the private beta —
 * everything operates around a single Workspace — so there is nothing to switch
 * between and no org to name above it. The control stays as a menu anchor for the
 * workspace itself, so multi-workspace support can return without moving the UI.
 */
function WorkspaceSwitcher({ workspace }: { workspace: Workspace }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="min-w-0 gap-2">
          <span className="text-small text-foreground min-w-0 truncate text-left font-medium">
            {workspace.name}
          </span>
          <ChevronDown aria-hidden="true" className="text-subtle shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-64">
        <DropdownMenuLabel>Your workspace</DropdownMenuLabel>
        <DropdownMenuItem>
          {workspace.name}
          <span className="sr-only">, current workspace</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>More workspaces coming soon</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
