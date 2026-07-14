import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('resolves conflicting Tailwind utilities last-wins', () => {
    // The whole reason twMerge exists. Without it both classes survive and the
    // winner depends on stylesheet order, silently breaking variant overrides.
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('keeps non-conflicting utilities', () => {
    expect(cn('flex', 'items-center')).toBe('flex items-center');
  });

  it('drops falsy values so conditional classes stay readable at call sites', () => {
    expect(cn('base', false && 'off', null, undefined, 'on')).toBe('base on');
  });

  it('accepts arrays and objects', () => {
    expect(cn(['flex', 'gap-2'], { 'sr-only': false, 'p-4': true })).toBe(
      'flex gap-2 p-4',
    );
  });

  it('treats display utilities as mutually exclusive', () => {
    // `flex` and `block` both set `display`, so the later one wins outright.
    // Worth pinning: it means `cn('flex', someCondition && 'block')` collapses
    // to a single display value rather than emitting both.
    expect(cn('flex', 'block')).toBe('block');
  });

  it('returns an empty string for no meaningful input', () => {
    expect(cn()).toBe('');
    expect(cn(undefined, false)).toBe('');
  });

  /**
   * Regression guard for a bug that silently deleted every typography token.
   *
   * Both KDS font sizes and KDS colors compile to `text-…` utilities. Default
   * tailwind-merge reads `text-title` as a color, finds it conflicts with
   * `text-foreground`, and drops it. Nothing errors; the type is just wrong
   * everywhere. See lib/cn.ts.
   */
  describe('KDS token merging', () => {
    const FONT_SIZES = [
      'text-display',
      'text-heading-xl',
      'text-heading-l',
      'text-heading-m',
      'text-heading-s',
      'text-title',
      'text-body-lg',
      'text-body',
      'text-small',
      'text-caption',
    ];

    const TEXT_COLORS = [
      'text-foreground',
      'text-muted-foreground',
      'text-muted',
      'text-danger',
      'text-success',
      'text-warning',
      'text-info',
      'text-intelligence-blue',
      'text-executive-purple',
      'text-on-intelligence-blue',
      'text-on-success',
      'text-on-warning',
      'text-on-danger',
      'text-on-info',
    ];

    it.each(FONT_SIZES)('%s survives alongside a text color', (size) => {
      const result = cn(size, 'text-foreground');
      expect(result).toContain(size);
      expect(result).toContain('text-foreground');
    });

    it.each(TEXT_COLORS)('%s survives alongside a font size', (color) => {
      const result = cn('text-small', color);
      expect(result).toContain(color);
      expect(result).toContain('text-small');
    });

    it('still treats two font sizes as conflicting', () => {
      expect(cn('text-small', 'text-title')).toBe('text-title');
    });

    it('still treats two text colors as conflicting', () => {
      expect(cn('text-muted', 'text-danger')).toBe('text-danger');
    });

    it('lets a caller override a size and a color independently', () => {
      // The variant-override pattern the whole design system depends on.
      expect(cn('text-small text-muted-foreground', 'text-title text-danger')).toBe(
        'text-title text-danger',
      );
    });

    it('does not confuse text alignment or wrapping with color', () => {
      const result = cn('text-caption text-muted-foreground text-center text-balance');
      for (const cls of [
        'text-caption',
        'text-muted-foreground',
        'text-center',
        'text-balance',
      ]) {
        expect(result).toContain(cls);
      }
    });
  });
});
