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
  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }} aria-hidden="true">
      {/* Lines first, so they sit under the circles rather than crossing them. */}
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0"
        style={{ width: SIZE, height: SIZE }}
      >
        {POSITIONS.map((pos, i) => (
          <line
            key={TOOLS[i]!.id}
            x1={pos.x}
            y1={pos.y}
            x2={CENTER}
            y2={CENTER}
            stroke="var(--landing-border)"
            strokeWidth={2}
          />
        ))}
      </svg>

      {/* The hub. */}
      <div
        className="absolute flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--landing-card)] shadow-[var(--landing-shadow-lifted)]"
        style={{ left: CENTER, top: CENTER }}
      >
        <LogoMark decorative className="size-9" />
      </div>

      {/* One node per tool, each with the real icon from the connections page. */}
      {TOOLS.map((tool, i) => {
        const Icon = integrationIcon(tool.id, tool.category);
        const pos = POSITIONS[i]!;
        return (
          <div
            key={tool.id}
            className="absolute flex size-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{ left: pos.x, top: pos.y }}
          >
            <div className="flex size-16 items-center justify-center rounded-full border border-[var(--landing-border)] bg-[var(--landing-card)] shadow-[var(--landing-shadow-card)]">
              <Icon aria-hidden="true" className="size-6 text-[var(--color-intelligence-blue)]" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
