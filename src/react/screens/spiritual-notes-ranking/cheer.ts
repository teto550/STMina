import { clampStars, type RankedKid } from '../spiritual-notes/logic';

/** One kid of the cheer show: no place and no points, only his picture, his name and his stars. */
export type CheerStep = {
  kid: { id: string; name: string };
  /** the kid's photo (a data URL or a link); '' = none, a cartoon face is drawn instead */
  photo: string;
  /** which cartoon face a kid without a photo gets (also picks the colours of his screen and the key of his music) */
  face: number;
  /** the stars the servant gave him in the last 4 weeks, in halves, 0 to 6: that many of the six stars on his screen light up */
  stars: number;
};

/** What the show says at the end, over the picture of everyone. */
export const CHEER_CLOSING = '🌟 كلكم أبطال.. كمّلوا كده! 🌟';

/** Shuffles a copy of the list (Fisher-Yates); `random` is injectable so the tests are not random. */
export function shuffled<T>(list: T[], random: () => number = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * The steps of the cheer show: EVERY kid that has points, once, in a random order (so nobody feels first or last), with the stars the servant gave him.
 * `stars` is what the servant gave each kid (by id); a kid without an entry has none.
 */
export function cheerSteps(ranked: RankedKid[], photos: Record<string, string> = {}, random: () => number = Math.random, stars: Record<string, number> = {}): CheerStep[] {
  return shuffled(ranked, random).map((k, i) => ({
    kid: { id: k.id, name: k.name },
    photo: photos[k.id] ?? '',
    face: i,
    stars: clampStars(stars[k.id]),
  }));
}
