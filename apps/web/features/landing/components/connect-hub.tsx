'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { LogoMark } from '@/components/brand/logo';
import { integrationIcon } from '@/features/connections/integration-meta';
import { TOOLS } from '../content';

/**
 * The tools flowing into Kloyya — a real diagram, not a stock illustration.
 *
 * Every icon comes from `integrationIcon`, the same lookup the connections
 * page uses, so a visitor sees the identical glyph before and after signing
 * up. Five tools, five fixed points on a circle — coordinates are precomputed
 * rather than measured at runtime, since the count never changes without this
 * file changing too.
 *
 * The motion is the diagram's whole point: lines draw themselves in, nodes
 * settle into place after, and a small pulse keeps travelling inward on a
 * loop — "information flowing into one place" said with motion rather than a
 * caption. `whileInView` + `once: true` means this plays exactly once per
 * visit, the moment the diagram scrolls into view, never on every re-render.
 */

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 140;
const NODE_COUNT = TOOLS.length;

/** Evenly spaced points on the circle, starting at the top, going clockwise. */
const POSITIONS = Array.from({ length: NODE_COUNT }, (_, i) => {
  const angle = (-90 + (360 / NODE_COUNT) * i) * (Math.PI / 180);
  return {
    x: CENTER + RADIUS * Math.cos(angle),
    y: CENTER + RADIUS * Math.sin(angle),
  };
});

export function ConnectHub() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }} aria-hidden="true">
      {/* Lines first, so they sit under the circles rather than crossing them. */}
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0"
        style={{ width: SIZE, height: SIZE }}
      >
        {POSITIONS.map((pos, i) => (
          <motion.line
            key={TOOLS[i]!.id}
            x1={pos.x}
            y1={pos.y}
            x2={CENTER}
            y2={CENTER}
            stroke="var(--landing-border)"
            strokeWidth={2}
            initial={prefersReducedMotion ? false : { pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
          />
        ))}

        {/* One travelling pulse per line, looping toward the hub. Skipped
            entirely under reduced motion rather than slowed down — a dot that
            never stops moving is exactly the kind of motion that setting asks
            to remove, not soften. */}
        {!prefersReducedMotion &&
          POSITIONS.map((pos, i) => (
            <motion.circle
              key={`pulse-${TOOLS[i]!.id}`}
              r={3}
              fill="var(--color-intelligence-blue)"
              initial={{ opacity: 0 }}
              animate={{
                cx: [pos.x, CENTER],
                cy: [pos.y, CENTER],
                opacity: [0, 0.9, 0],
              }}
              transition={{
                duration: 1.8,
                delay: 1 + i * 0.35,
                repeat: Infinity,
                repeatDelay: NODE_COUNT * 0.35,
                ease: 'easeIn',
              }}
            />
          ))}
      </svg>

      {/* The hub. */}
      <motion.div
        className="absolute flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--landing-card)] shadow-[var(--landing-shadow-lifted)]"
        style={{ left: CENTER, top: CENTER }}
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.7 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <LogoMark decorative className="size-9" />
      </motion.div>

      {/* One node per tool, each with the real icon from the connections page. */}
      {TOOLS.map((tool, i) => {
        const Icon = integrationIcon(tool.id, tool.category);
        const pos = POSITIONS[i]!;
        return (
          <motion.div
            key={tool.id}
            className="absolute flex size-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{ left: pos.x, top: pos.y }}
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35, delay: 0.3 + i * 0.08, ease: 'easeOut' }}
          >
            <div className="flex size-16 items-center justify-center rounded-full border border-[var(--landing-border)] bg-[var(--landing-card)] shadow-[var(--landing-shadow-card)]">
              <Icon aria-hidden="true" className="size-6 text-[var(--color-intelligence-blue)]" />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
