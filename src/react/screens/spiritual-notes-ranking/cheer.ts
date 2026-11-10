import type { RankedKid } from '../spiritual-notes/logic';
import { shortName } from './podium';

/** One kid of the cheer show: no place and no points, only his picture, his name and a rhyme of his own. */
export type CheerStep = {
  kid: { id: string; name: string };
  /** the kid's photo (a data URL or a link); '' = none, a cartoon face is drawn instead */
  photo: string;
  /** which cartoon face a kid without a photo gets (also picks the colours of his screen and the key of his music) */
  face: number;
  /** the rhyme under his name, with his name already in it */
  line: string;
};

/** Short rhymes for the kids, `{name}` is replaced by the kid's first two names. More lines than kids means nobody hears the same one twice. */
export const CHEER_LINES: string[] = [
  '{name} شاطر ومثابر، وربنا معاه في كل خاطر 💪',
  '{name} نجم ساطع، وفي النوتة دايماً طالع 🌟',
  'برافو يا {name} يا بطل، وربنا يكمّل لك الجميل 🏅',
  '{name} قلبه نضيف، ومجهوده شرف وتشريف ✨',
  '{name} بيحب يجتهد، وربنا بيقوّيه ويسنِد 💫',
  'يا {name} يا حبيبنا، ربنا يفرّح قلبك ويبارك دربنا 🙏',
  '{name} بيقرا الإنجيل كل يوم، وبيزيد نوره زي النجوم 🌙',
  '{name} بيصوم ويصلي، وقلبه عند ربنا متملي 🕊️',
  'عاش يا {name} يا متفاني، ربنا يفرّح قلبك ويديك الأماني 🎈',
  '{name} كل يوم أحلى، وجهده يرفع راسنا لفوق وأعلى 🚀',
  '{name} حلو وطيب، وربنا يجيب له كل خير قريب 🌈',
  'يا {name} يا بطل الحكاية، ربنا يوصلك لأعلى غاية 🏆',
  '{name} مجتهد وأمين، وربنا معاه يعين 🙌',
  '{name} فرحتنا بيك كبيرة، وخطواتك دايماً منيرة 🌻',
  '{name} زرع تعب وجهد، وربنا هيحصّد له فرح وسعد 🎉',
  '{name} نوره بيزيد، وفي الخدمة دايماً سعيد 😍',
  'عيون {name} بتلمع، وقلبه بالمحبة بيسمع 🎶',
];

/** What the show says at the end, over the picture of everyone. */
export const CHEER_CLOSING = '🌟 كلكم أبطال.. كمّلوا كده! 🌟';

/** Puts the kid's name in a rhyme. */
export const fillLine = (line: string, name: string): string => line.replaceAll('{name}', name);

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
 * The steps of the cheer show: EVERY kid that has points, once, in a random order (so nobody feels first or last), each with a rhyme of his own.
 * The rhymes are shuffled too and used one after the other, so they only repeat when there are more kids than rhymes.
 */
export function cheerSteps(ranked: RankedKid[], photos: Record<string, string> = {}, random: () => number = Math.random, lines: string[] = CHEER_LINES): CheerStep[] {
  const kids = shuffled(ranked, random);
  const rhymes = shuffled(lines, random);
  return kids.map((k, i) => ({
    kid: { id: k.id, name: k.name },
    photo: photos[k.id] ?? '',
    face: i,
    line: fillLine(rhymes[i % rhymes.length] ?? '{name} بطل 🌟', shortName(k.name)),
  }));
}
