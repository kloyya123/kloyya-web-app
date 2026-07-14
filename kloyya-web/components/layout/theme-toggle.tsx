'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui';

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

/**
 * KDS: "Theme switching should be instantaneous."
 *
 * The trigger icon depends on the resolved theme, which the server cannot know.
 * Rendering it before mount would produce a hydration mismatch and, worse, a
 * visible icon flip. So the button renders in a neutral state until mounted —
 * it keeps its size and its accessible name throughout, so nothing shifts.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => setIsMounted(true), []);

  const Icon = !isMounted ? Monitor : resolvedTheme === 'light' ? Sun : Moon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Icon aria-hidden="true" />
          <span className="sr-only">Change theme</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {OPTIONS.map((option) => {
          const OptionIcon = option.icon;
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setTheme(option.value)}
              // Radix renders this as a menuitem; `aria-checked` would need a
              // radio role. The check mark is conveyed by the text instead.
              className={isMounted && theme === option.value ? 'text-link' : undefined}
            >
              <OptionIcon aria-hidden="true" />
              {option.label}
              {isMounted && theme === option.value ? (
                <span className="sr-only">, selected</span>
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
