import { useMemo, type CSSProperties, type FC } from 'react';

type ConfettiProps = {
  /** how many pieces fall */
  count: number;
};

const COLORS = ['#ef4444', '#3b82f6', '#facc15', '#22c55e', '#a855f7', '#f97316', '#ec4899'];
// every 4th piece is a shape instead of a paper
const GLYPHS = ['⭐', '🎈', '🎊', '✨', '💛', '🌟'];

type Piece = { style: CSSProperties; glyph?: string };

/** The pieces are always the same for the same count (a small seeded generator, no Math.random), so a re-render does not make them jump. */
function piecesOf(count: number): Piece[] {
  let seed = 12345;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: count }, (_, i) => {
    const size = 6 + next() * 8;
    const common = { left: `${next() * 100}%`, '--rx-delay': `${next() * 3}s`, '--rx-dur': `${2.8 + next() * 2.4}s`, '--rx-drift': `${(next() - 0.5) * 160}px` };
    if (i % 4 === 3) {
      return { glyph: GLYPHS[(i >> 2) % GLYPHS.length], style: { ...common, fontSize: 18 + next() * 12 } as CSSProperties };
    }
    return {
      style: {
        ...common,
        width: size,
        height: next() > 0.5 ? size : size * 0.5,
        borderRadius: next() > 0.6 ? '50%' : 2,
        background: COLORS[i % COLORS.length],
      } as CSSProperties,
    };
  });
}

/** Paper pieces and shapes (stars, balloons) falling over the whole screen (they hide when the device asks for less motion). */
export const Confetti: FC<ConfettiProps> = ({ count }) => {
  const pieces = useMemo(() => piecesOf(count), [count]);
  return (
    <div aria-hidden="true" className="tw:pointer-events-none tw:absolute tw:inset-0 tw:overflow-hidden">
      {pieces.map((piece, i) => (
        <span key={i} className="rx-fall tw:absolute tw:top-0" style={piece.style}>{piece.glyph}</span>
      ))}
    </div>
  );
};
