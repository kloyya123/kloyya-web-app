import { cn } from '@/lib/cn';

/**
 * The Kloyya mark.
 *
 * A flat distillation of the brand asset in `LOGO/kloyya logo.png`: the same
 * six-blade aperture, the same two brand colors (Intelligence Blue #2563EB into
 * Executive Purple #7C3AED). Rebuilt as vector because the raster is 884 KB and
 * carries a baked-in dark rectangle that reads as a black box in light mode.
 *
 * KDS Visual Identity: "Avoid heavy gradients, decorative effects." The single
 * two-stop gradient here is the brand's own, applied once, at a size where it
 * reads as a color shift rather than a sheen.
 *
 * The aperture is not decoration: it is a lens closing to a point of focus,
 * which is the product's argument in one shape.
 */

/** One blade, swept from the centre out to the rim. Rotated six times. */
const BLADE = 'M24 24 C 25 15, 30 9, 38 8 C 35 16, 31 21, 24 24 Z';
const ANGLES = [0, 60, 120, 180, 240, 300] as const;

export interface LogoMarkProps {
  /**
   * When the mark sits beside the wordmark, the wordmark is the accessible name
   * and the mark must be silent. Two adjacent nodes both named "Kloyya" is a
   * screen reader reading the brand twice.
   */
  decorative?: boolean;
  /**
   * Slowly rotate the aperture — the lens quietly "thinking". Used beside Ask
   * Kloyya. Stilled for anyone who prefers reduced motion.
   */
  animated?: boolean;
  className?: string;
}

export function LogoMark({ decorative = false, animated = false, className }: LogoMarkProps) {
  const labelling = decorative
    ? ({ 'aria-hidden': true } as const)
    : ({ role: 'img', 'aria-label': 'Kloyya' } as const);

  return (
    <svg viewBox="0 0 48 48" className={cn('size-8', className)} {...labelling}>
      <defs>
        {/* The id is static. Multiple instances emit identical defs, which every
            browser resolves to the same paint server. */}
        <linearGradient id="kloyya-aperture" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-info)" />
          <stop offset="45%" stopColor="var(--color-intelligence-blue)" />
          <stop offset="100%" stopColor="var(--color-executive-purple)" />
        </linearGradient>
      </defs>

      <g
        className={cn(animated && 'motion-safe:animate-[spin_9s_linear_infinite]')}
        style={animated ? { transformOrigin: '24px 24px' } : undefined}
      >
        {ANGLES.map((angle) => (
          <path
            key={angle}
            d={BLADE}
            fill="url(#kloyya-aperture)"
            transform={`rotate(${angle} 24 24)`}
            // Alternating opacity gives the blades depth without a drop shadow.
            opacity={angle % 120 === 0 ? 1 : 0.72}
          />
        ))}
      </g>
    </svg>
  );
}

export interface LogoProps {
  /** Hide the wordmark, leaving only the aperture. For collapsed navigation. */
  markOnly?: boolean;
  className?: string;
}

export function Logo({ markOnly = false, className }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark decorative={!markOnly} />
      {!markOnly ? (
        <span className="text-title text-foreground font-semibold tracking-tight">
          Kloyya
        </span>
      ) : null}
    </span>
  );
}
