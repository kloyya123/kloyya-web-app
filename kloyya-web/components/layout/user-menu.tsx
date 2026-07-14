'use client';

import { LogOut, Settings, User as UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui';
import { initials } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';
import type { User } from '@/types/domain';

export function UserMenu({ user }: { user: User }) {
  const router = useRouter();
  const { signOut } = useAuth();

  async function onSignOut() {
    await signOut();
    // `replace`, not `push`: Back must not return to an authenticated screen
    // whose data is already gone from the cache.
    router.replace('/login');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="rounded-full">
          <Avatar size="sm">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt="" />
            ) : null}
            <AvatarFallback>{initials(user.fullName)}</AvatarFallback>
          </Avatar>
          <span className="sr-only">Account menu for {user.fullName}</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>
          <span className="text-small text-foreground block font-medium">
            {user.fullName}
          </span>
          <span className="text-caption text-subtle block truncate">{user.email}</span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled>
          <UserIcon aria-hidden="true" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Settings aria-hidden="true" />
          Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem isDestructive onSelect={() => void onSignOut()}>
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
