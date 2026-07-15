'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentPropsWithoutRef } from 'react';
import { Input } from '@/components/ui';

/**
 * A password field with a reveal toggle.
 *
 * The toggle is a real button with a changing accessible name, not an icon that
 * silently mutates the input type: a screen-reader user needs to know the
 * password is currently visible on screen before they read it aloud in an office.
 *
 * `aria-pressed` communicates the toggle's state; the visible icon shows the
 * *action* (an open eye means "show"), which is the convention users expect.
 */
export function PasswordInput(props: ComponentPropsWithoutRef<typeof Input>) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <Input
      {...props}
      type={isVisible ? 'text' : 'password'}
      trailingSlot={
        <button
          type="button"
          onClick={() => setIsVisible((visible) => !visible)}
          aria-pressed={isVisible}
          className="text-muted-foreground hover:text-foreground hover:bg-hover flex size-8 items-center justify-center rounded-sm transition-colors"
        >
          {isVisible ? (
            <EyeOff aria-hidden="true" className="size-4" />
          ) : (
            <Eye aria-hidden="true" className="size-4" />
          )}
          <span className="sr-only">
            {isVisible ? 'Hide password' : 'Show password'}
          </span>
        </button>
      }
    />
  );
}
