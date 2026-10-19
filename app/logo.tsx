import MARK from "@/lib/logo-mark.json";

// The Reminder Wall mark, drawn from the same geometry as the app icons
// (scripts/generate_icons.mjs).
export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  const G = MARK.grid;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${G} ${G}`} className={className} aria-hidden="true">
      <defs>
        <linearGradient id="rw-tile" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={MARK.tile.top} />
          <stop offset="1" stopColor={MARK.tile.bottom} />
        </linearGradient>
        <clipPath id="rw-clip"><rect width={G} height={G} rx={MARK.radius} /></clipPath>
      </defs>
      <rect width={G} height={G} rx={MARK.radius} fill="url(#rw-tile)" />
      <g clipPath="url(#rw-clip)" fill={MARK.ink}>
        {MARK.bars.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} opacity={b.opacity} />
        ))}
      </g>
    </svg>
  );
}
