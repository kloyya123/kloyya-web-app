import type { Transition, Variants } from 'framer-motion';

/**
 * Motion tokens, mirrored from `styles/tokens.css`.
 *
 * Framer Motion needs numbers, CSS needs custom properties, and Tailwind v4 has
 * no `--duration-*` theme namespace — so there is no single representation that
 * serves all three. These values are the JS mirror. If you change one, change
 * `tokens.css` too; `motion.test.ts` documents the contract but cannot read CSS.
 *
 * KDS durations: 100ms, 150ms, 200ms, 300ms, 500ms.
 * KDS easing: Ease Out, Ease In Out, Spring.
 * KDS: "Motion should communicate state — not decoration."
 */
export const DURATION = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.2,
  slow: 0.3,
  deliberate: 0.5,
} as const;

export const EASE = {
  out: [0.16, 1, 0.3, 1],
  inOut: [0.65, 0, 0.35, 1],
  spring: [0.34, 1.56, 0.64, 1],
} as const satisfies Record<string, [number, number, number, number]>;

/** The default transition for almost everything. Fast, eased out, unobtrusive. */
export const transition: Transition = {
  duration: DURATION.normal,
  ease: EASE.out,
};

/**
 * Fade + a short rise. The Manifesto asks that recommendations "appear
 * naturally" rather than announce themselves — 4px, not 24px.
 */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition },
};

/**
 * Stagger children so a list resolves as a sequence rather than a flash.
 * Kept short: at 12 items and 0.04s, the last one lands under half a second.
 */
export function staggerContainer(staggerChildren = 0.04): Variants {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren, delayChildren: 0.02 },
    },
  };
}

/**
 * Motion-safe variants. When the user prefers reduced motion, every variant
 * collapses to an opacity-only change — never a transform, never a slide.
 *
 * CSS handles declarative transitions globally (see globals.css); this covers
 * the JS-driven half that Framer Motion owns.
 */
export function motionSafe(variants: Variants, prefersReduced: boolean): Variants {
  if (!prefersReduced) return variants;
  return {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: DURATION.instant } },
  };
}
