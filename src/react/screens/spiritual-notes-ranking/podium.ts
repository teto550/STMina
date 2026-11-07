import type { CSSProperties } from 'react';
import type { RankedKid } from '../spiritual-notes/logic';

export type PodiumPlace = 1 | 2 | 3;

/** One reveal of the show: ONE kid in his place. Kids that tie share a place, so the same place comes up once for each of them. */
export type PodiumStep = {
  place: PodiumPlace;
  kid: RankedKid;
  /** the kid's photo (a data URL or a link); '' = none, a cartoon face is drawn instead */
  photo: string;
  /** a kid that ties with the one revealed just before: the wait before him is short */
  again: boolean;
  /** which cartoon face a kid without a photo gets: a different one for every step of the show */
  face: number;
};

/**
 * The reveals of the show, in order: the third place, then the second, then the first (each kid of a tie on his own, by name). It uses the same
 * places as the ranking list (a tie shares a place and the next one is skipped: 1, 1, 3), so a place nobody holds is simply not shown.
 */
export function podiumSteps(ranked: RankedKid[], photos: Record<string, string> = {}): PodiumStep[] {
  const steps: PodiumStep[] = [];
  for (const place of [3, 2, 1] as const) {
    ranked
      .filter((k) => k.rank === place)
      .forEach((kid, i) => {
        steps.push({ place, kid, photo: photos[kid.id] ?? '', again: i > 0, face: steps.length });
      });
  }
  return steps;
}

/** The first two names only ("بيتر ماهر جرجس" -> "بيتر ماهر"). */
export function shortName(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).join(' ');
}

/** The cartoon faces of the kids without a photo: each one has its own face and its own colour. */
const FACES = [
  { emoji: '👦', from: '#60a5fa', to: '#2563eb' },
  { emoji: '🧒🏽', from: '#f472b6', to: '#be185d' },
  { emoji: '👦🏻', from: '#4ade80', to: '#15803d' },
  { emoji: '🧒🏾', from: '#fb923c', to: '#c2410c' },
  { emoji: '👦🏼', from: '#a78bfa', to: '#6d28d9' },
  { emoji: '🧒', from: '#2dd4bf', to: '#0f766e' },
  { emoji: '👦🏽', from: '#facc15', to: '#a16207' },
  { emoji: '🧒🏻', from: '#f87171', to: '#b91c1c' },
  { emoji: '👦🏾', from: '#38bdf8', to: '#0369a1' },
  { emoji: '🧒🏼', from: '#c084fc', to: '#7e22ce' },
];

export function faceOf(index: number): { emoji: string; from: string; to: string } {
  return FACES[index % FACES.length] ?? FACES[0]!;
}

/** How each place looks: its words, its medal and its colours (`tw:` classes, so Tailwind finds them). */
export const PLACES: Record<PodiumPlace, { label: string; medal: string; card: string; ink: string; block: string }> = {
  3: { label: 'المركز التالت', medal: '🥉', card: 'tw:from-[#fb923c] tw:to-[#b45309]', ink: 'tw:text-white', block: 'tw:h-24' },
  2: { label: 'المركز التاني', medal: '🥈', card: 'tw:from-[#f1f5f9] tw:to-[#94a3b8]', ink: 'tw:text-slate-900', block: 'tw:h-36' },
  1: { label: 'المركز الأول', medal: '🥇', card: 'tw:from-[#fef08a] tw:to-[#f59e0b]', ink: 'tw:text-amber-950', block: 'tw:h-48' },
};

/** What the servant sees under the kid's name: a cheer for his place (a different one for every kid, so a tie does not repeat it). */
const CHEERS: Record<PodiumPlace, string[]> = {
  3: ['شاطر يا بطل! 💪', 'كمّل كده! 🔥', 'برافو عليك! 👏'],
  2: ['ما شاء الله عليك! 🌟', 'مجهود جامد! 💫', 'إنت نجم! ⭐'],
  1: ['البطل بتاعنا! 🏆', 'إنت أسطورة! 👑', 'ربنا يباركك يا بطل! 🎉'],
};

export function cheerOf(place: PodiumPlace, index: number): string {
  const list = CHEERS[place];
  return list[index % list.length] ?? '';
}

/** The order of the finished podium, left to right: second, first, third. */
export const PODIUM_ORDER: PodiumPlace[] = [2, 1, 3];

/** Delays an `rx-*` animation (see styles.css) by `seconds`. */
export const delayed = (seconds: number): CSSProperties => ({ '--rx-delay': `${seconds}s` }) as CSSProperties;
