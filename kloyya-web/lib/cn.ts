import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * KDS font sizes (`--text-*` in tokens.css) and KDS colors (`--color-*`).
 *
 * Both produce `text-…` utilities, and tailwind-merge cannot tell them apart
 * without being told: out of the box it reads `text-title` as a *color* and
 * discards it when it meets `text-foreground`. The result is that every
 * typography token in the design system silently vanishes wherever a component
 * sets a size and a color together — which is almost everywhere.
 *
 * Keep both lists in sync with `styles/tokens.css`. `cn.test.ts` fails loudly
 * if a token here stops surviving a merge.
 */
const KDS_FONT_SIZES = [
  'display',
  'heading-xl',
  'heading-l',
  'heading-m',
  'heading-s',
  'title',
  'body-lg',
  'body',
  'small',
  'caption',
] as const;

const KDS_TEXT_COLORS = [
  'foreground',
  'muted-foreground',
  'muted',
  'background',
  'surface',
  'card',
  'border',
  'hover',
  'ring',
  // Accents. Valid as fills and borders; as *text* use the ink tokens below.
  'intelligence-blue',
  'executive-purple',
  'success',
  'warning',
  'danger',
  'info',
  // Foregrounds drawn on top of an accent fill.
  'on-intelligence-blue',
  'on-executive-purple',
  'on-success',
  'on-warning',
  'on-danger',
  'on-info',
  // Ink: accent-colored text on a neutral surface. Theme-aware, AA-verified.
  'link',
  'ai',
  'positive',
  'caution',
  'critical',
  'notice',
  'subtle',
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...KDS_FONT_SIZES] }],
      'text-color': [{ text: [...KDS_TEXT_COLORS] }],
    },
  },
});

/**
 * Merge conditional class names, resolving Tailwind conflicts last-wins.
 *
 * Without twMerge, `cn('p-2', 'p-4')` emits both and the winner depends on
 * stylesheet order rather than call order — which silently breaks the variant
 * override pattern every component in the design system relies on.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
