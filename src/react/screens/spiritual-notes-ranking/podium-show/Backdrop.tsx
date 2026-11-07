import { useMemo, type CSSProperties, type FC } from 'react';

type BackdropProps = {
  /** the shapes that float up the screen (emoji) */
  glyphs: string[];
};

const COUNT = 22;

/** The shapes are always the same for the same list (a small seeded generator, no Math.random), so a re-render does not make them jump. */
function shapesOf(glyphs: string[]): { glyph: string; style: CSSProperties }[] {
  let seed = 4242;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: COUNT }, (_, i) => ({
    glyph: glyphs[i % glyphs.length] ?? '⭐',
    style: {
      left: `${next() * 96}%`,
      bottom: '-12vh',
      fontSize: 22 + next() * 34,
      opacity: 0.35 + next() * 0.4,
      '--rx-dur': `${8 + next() * 7}s`,
      '--rx-delay': `${-next() * 12}s`, // negative: they are already on their way when the screen opens
      '--rx-drift': `${(next() - 0.5) * 120}px`,
    } as CSSProperties,
  }));
}

/** Behind everything: rays turning slowly around the middle and shapes (stars, balloons, trophies...) floating up, without ever stopping. */
export const Backdrop: FC<BackdropProps> = ({ glyphs }) => {
  const shapes = useMemo(() => shapesOf(glyphs), [glyphs]);
  return (
    <div aria-hidden="true" className="tw:pointer-events-none tw:absolute tw:inset-0 tw:overflow-hidden">
      <div
        className="rx-spin tw:absolute"
        style={{
          left: '50%',
          top: '50%',
          width: '220vmax',
          height: '220vmax',
          marginLeft: '-110vmax',
          marginTop: '-110vmax',
          background: 'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.12) 0deg 9deg, transparent 9deg 18deg)',
          maskImage: 'radial-gradient(circle, black 4%, transparent 40%)',
          WebkitMaskImage: 'radial-gradient(circle, black 4%, transparent 40%)',
        }}
      />
      {shapes.map((shape, i) => (
        <span key={i} className="rx-float tw:absolute" style={shape.style}>{shape.glyph}</span>
      ))}
    </div>
  );
};
