import type { CSSProperties } from 'react';
import type { RankedKid } from '../spiritual-notes/logic';

export type PodiumPlace = 1 | 2 | 3;

/** One place of the show: the kids that share it (a tie shares a place) and the points they share. */
export type PodiumStep = { place: PodiumPlace; kids: RankedKid[]; points: number };

/**
 * The places the winners show reveals, in the order it reveals them: third, then second, then first. It uses the same places as the ranking list
 * (a tie shares a place and the next one is skipped: 1, 1, 3), so a place nobody holds is simply not shown.
 */
export function podiumSteps(ranked: RankedKid[]): PodiumStep[] {
  const steps: PodiumStep[] = [];
  for (const place of [3, 2, 1] as const) {
    const kids = ranked.filter((k) => k.rank === place);
    const first = kids[0];
    if (first) {
      steps.push({ place, kids, points: first.month });
    }
  }
  return steps;
}

/** How each place looks: its words, its medal and its colours (`tw:` classes, so Tailwind finds them). */
export const PLACES: Record<PodiumPlace, { label: string; medal: string; card: string; ink: string; block: string }> = {
  3: { label: 'المركز التالت', medal: '🥉', card: 'tw:from-[#fb923c] tw:to-[#b45309]', ink: 'tw:text-white', block: 'tw:h-24' },
  2: { label: 'المركز التاني', medal: '🥈', card: 'tw:from-[#f1f5f9] tw:to-[#94a3b8]', ink: 'tw:text-slate-900', block: 'tw:h-36' },
  1: { label: 'المركز الأول', medal: '🥇', card: 'tw:from-[#fef08a] tw:to-[#f59e0b]', ink: 'tw:text-amber-950', block: 'tw:h-48' },
};

/** The order of the finished podium, left to right: second, first, third. */
export const PODIUM_ORDER: PodiumPlace[] = [2, 1, 3];

/** Delays an `rx-*` animation (see styles.css) by `seconds`. */
export const delayed = (seconds: number): CSSProperties => ({ '--rx-delay': `${seconds}s` }) as CSSProperties;
