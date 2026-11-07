import { useMemo, type CSSProperties, type FC } from 'react';

type BurstProps = {
  glyphs: string[];
  /** how many shapes fly out */
  count: number;
  /** how far they fly (px) */
  radius: number;
};

/** Stars and sparkles flying out of the middle in every direction, again and again (like fireworks). The middle is the parent's middle. */
export const Burst: FC<BurstProps> = ({ glyphs, count, radius }) => {
  const shapes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const far = radius * (i % 2 === 0 ? 1 : 0.75);
        return {
          glyph: glyphs[i % glyphs.length] ?? '✨',
          style: {
            '--rx-x': `${Math.round(Math.cos(angle) * far)}px`,
            '--rx-y': `${Math.round(Math.sin(angle) * far)}px`,
            '--rx-delay': `${(i % 4) * 0.25}s`,
            fontSize: 26,
          } as CSSProperties,
        };
      }),
    [glyphs, count, radius],
  );
  return (
    <div aria-hidden="true" className="tw:pointer-events-none tw:absolute tw:inset-0 tw:flex tw:items-center tw:justify-center">
      {shapes.map((shape, i) => (
        <span key={i} className="rx-burst tw:absolute" style={shape.style}>{shape.glyph}</span>
      ))}
    </div>
  );
};
