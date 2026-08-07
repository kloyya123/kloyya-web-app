import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AA_NORMAL_TEXT, contrastRatio } from '@/lib/contrast';

/**
 * The accessibility contract for the design system, checked against the token
 * file itself rather than against a copy of it.
 *
 * KDS mandates its accent hexes *and* WCAG 2.2 AA, and those two requirements
 * conflict — Warning on white is 2.15:1. The resolution is two derived layers:
 *
 *   `--color-on-*`  foreground drawn on top of an accent fill
 *   `--color-*` ink accent-colored text drawn on a neutral surface
 *
 * This test is the thing that stops a well-meaning tweak to either from
 * silently reintroducing a failure. It parses tokens.css, so it cannot drift.
 */

const TOKENS = readFileSync(join(process.cwd(), 'styles', 'tokens.css'), 'utf8');

/** Pull `--name: #rrggbb;` out of a `{ … }` block that starts with `selector`. */
function readBlock(selector: string): Record<string, string> {
  const start = TOKENS.indexOf(selector);
  if (start === -1) throw new Error(`Selector not found in tokens.css: ${selector}`);

  const open = TOKENS.indexOf('{', start);
  const close = TOKENS.indexOf('}', open);
  const body = TOKENS.slice(open, close);

  const entries: Record<string, string> = {};
  for (const [, name, hex] of body.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    if (name && hex) entries[name] = hex.toLowerCase();
  }
  return entries;
}

const theme = readBlock('@theme');
// The app has one theme now — :root and .light are the same block by design
// (see tokens.css); reading either gives the same values.
const light = readBlock('.light');

function token(block: Record<string, string>, name: string): string {
  const value = block[name];
  if (!value) throw new Error(`Token ${name} missing or not a literal hex.`);
  return value;
}

describe('KDS accent hexes are preserved exactly', () => {
  // If any of these change, the design system no longer matches the spec.
  it.each([
    ['--color-intelligence-blue', '#2563eb'],
    ['--color-executive-purple', '#7c3aed'],
    ['--color-success', '#16a34a'],
    ['--color-warning', '#f59e0b'],
    ['--color-danger', '#dc2626'],
    ['--color-info', '#0ea5e9'],
  ])('%s is %s', (name, expected) => {
    expect(token(theme, name)).toBe(expected);
  });
});

describe('on-* foregrounds meet AA against their accent fill', () => {
  it.each([
    ['--color-on-intelligence-blue', '--color-intelligence-blue'],
    ['--color-on-executive-purple', '--color-executive-purple'],
    ['--color-on-success', '--color-success'],
    ['--color-on-warning', '--color-warning'],
    ['--color-on-danger', '--color-danger'],
    ['--color-on-info', '--color-info'],
  ])('%s on %s', (fg, bg) => {
    const ratio = contrastRatio(token(theme, fg), token(theme, bg));
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});

/** The four neutral surfaces a component can sit on, per theme. */
const SURFACE_TOKENS = [
  '--kds-background',
  '--kds-surface',
  '--kds-card',
  '--kds-hover',
] as const;

const INK_TOKENS = [
  '--kds-ink-link',
  '--kds-ink-ai',
  '--kds-ink-positive',
  '--kds-ink-caution',
  '--kds-ink-critical',
  '--kds-ink-notice',
  '--kds-ink-subtle',
] as const;

const TEXT_TOKENS = ['--kds-text-primary', '--kds-text-secondary'] as const;

describe('light theme', () => {
  const block = light;

  describe('ink meets AA for normal text on every surface', () => {
    for (const ink of INK_TOKENS) {
      for (const surface of SURFACE_TOKENS) {
        it(`${ink} on ${surface}`, () => {
          const ratio = contrastRatio(token(block, ink), token(block, surface));
          expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
        });
      }
    }
  });

  describe('primary and secondary text meet AA on every surface', () => {
    for (const text of TEXT_TOKENS) {
      for (const surface of SURFACE_TOKENS) {
        it(`${text} on ${surface}`, () => {
          const ratio = contrastRatio(token(block, text), token(block, surface));
          expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
        });
      }
    }
  });

  it('--kds-muted is NOT used for readable text', () => {
    // Documents the trap rather than hiding it. KDS's Muted fails AA on its own
    // surface, so it is reserved for decorative and disabled affordances.
    // Readable de-emphasized text uses `--kds-ink-subtle`.
    const ratio = contrastRatio(token(block, '--kds-muted'), token(block, '--kds-card'));
    expect(ratio).toBeLessThan(AA_NORMAL_TEXT);
  });
});
