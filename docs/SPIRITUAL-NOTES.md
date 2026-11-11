# النوتة الروحية (spiritual notes)

A tab next to الحضور / المخدومين for ONE class of the boys' section (the trial): `سنة رابعة ابتدائي`. The list of classes is
`SPIRITUAL_NOTES_GRADES` in `src/core/notes-access.ts`; add a class there to open the tab for it. The girls' section never has it.

## What it does
- The tab lists the kids of the open class with a search box (spelling variants of the same name match).
- Opening a kid opens his file: pick a day (the week runs from Friday to Thursday, with "الأسبوع اللي فات / الأسبوع الجاي" to move between weeks, or any date), tick الصبح / بليل, tick الإنجيل (قرأ — only that he read, the verse is not written), tick القداس,
  الصوم (shown on Wednesday and Friday only) and the month's الاعتراف, then "حفظ اليوم". Below: the last 30 days he has something in.
- Any servant of the class (and admins) can write, like the other class tabs (`canManageGrade`).

## Points (shown at the top of every kid's file: اليوم / الأسبوع / الشهر)
The starting points (`DEFAULT_POINTS` in `src/core/notes-points.ts`): صلاة الصبح 5 · صلاة بليل 5 · الإنجيل 15 · القداس 20 · الصوم 10 (Wednesday and Friday only) · الاعتراف 25 (once a month).

### ⚙️ نقاط النوتة (the admin sets the points)
A button at the top of the نوتة روحية tab, shown to admins only (`canSetPoints`, passed from `showNotes` in `features/shell/tabs.ts`). It opens a sheet (`PointsSettings.tsx`) with a box per thing (0 to 1000, whole numbers; "الأصلية" puts the starting points back) and "حفظ النقاط".
- **One setting for the whole app**, stored in `config/notes-points` = `{ points: {prayerMorning, prayerNight, gospel, mass, fast, confession}, updatedAt, updatedBy }`. The existing `config` rules already let every signed-in person read and only an admin write, so there is NO rules change to deploy. Migration note: a one-row `notes_points` table.
- **Counts for every day, old ones too**: the points are worked out from what was ticked (never stored with a day), so a change re-prices the whole history, the kid's file (اليوم / الأسبوع / الشهر) and the ranking at once.
- Everybody sees the current points as a small line under the title. Until the admin saves, or when the document cannot be read, the starting points count (`cleanPoints` also repairs a hand-edited document). One extra read (cached 5 minutes) per opened screen: `useNotePoints` in `src/react/hooks/useSpiritualNotes.ts`.
- Tests: `notes-points.test.ts`, the `custom points` block of `spiritual-notes-logic.test.ts`, and the `نقاط النوتة` block of `SpiritualNotesScreen.test.tsx`.
- Day = the ticks of that day (the confession is not in it). Week = the 7 days Friday→Thursday (the confession is not in it, it has no date).
  Month = the last 4 weeks (Friday→Thursday, ending with the week of the open day, `monthRange`) + 25 when he confessed in the calendar month of the open day.
- Reads: one extra query per opened kid/day, `fetchKidDaysBetween` (the last 4 weeks, which contain the open week, at most 28 documents).
- Older notes that hold the gospel as TEXT count as "read" (15 points); new saves write `gospel: true/false`.

## Statistics > النوتة الروحية (ranking)
A sub-tab next to ⭐ النجوم in the statistics tab, shown only for the classes in `SPIRITUAL_NOTES_GRADES` (`initStatsTab` hides the button otherwise).
Screen `src/react/screens/spiritual-notes-ranking`: the kids with points in the last 4 weeks (the same "نقط الشهر" of the kid's file), highest first; kids
with the same score share the same place (1, 2, 2, 4), by name inside a place; kids with no points are left out. The servant filter of the statistics applies.
Reads: for each kid one range query (the written days of the last 4 weeks) + 1 confession document, 8 kids at a time (`fetchKidsMonthData`), kept 5 minutes; the 🔄 button reads again.

### 🏆 عرض (the winners show)
A button next to 🔄 in the ranking header, shown only when somebody has points. It opens a full-screen show to put in front of the class (a quiz-game podium):
"يلا نبدأ" (this tap also unlocks the browser's audio) → the kids come from the LAST place up to the first (every kid with points). A place under the third: a short drum roll, a 3-2-1 and "المركز ٥" → the kid
with his picture, his FIRST TWO NAMES only, his points and a cheer. From the THIRD place on (`ClimbPodium.tsx`): a round podium of stacked round tiers (3rd = 2 tiers, 2nd = 3, 1st = 4) where a ❓ hops up the tiers
until it reaches the top, then the kid's picture lands there with his name above it (the winner with a crown, a glow, more confetti and a bigger fanfare) → the finished podium (second · first · third) with "إعادة العرض" / "إغلاق".
- **One kid per step.** Kids with the same score share a place and come one after the other in that place (the second one gets a short drum roll and "ومعاه كمان واحد!"). The places are the ones
  of the list: a tie skips the next place (1, 1, 3 shows the third, then both first-place kids); a place nobody holds is not shown. The places under the third use shorter times (`PODIUM_TIMES.other`).
- **Pictures:** the photo of the kid's card (`photo`, passed from `renderNotesStats` in `src/features/dashboard/stats.ts`); a kid without one (or whose photo does not load) gets a cartoon face on a
  coloured background, a different one for every step (`faceOf` in `podium.ts`).
- **Looks:** the background changes with the part (suspense = dark and tense, each place its own colours, finale = purple) and never stops moving: turning rays and shapes (stars, balloons, drums,
  trophies...) floating up, rings and stars bursting around the picture, shape confetti, a wiggling cheer. The decoration is CSS (`rx-*` in `src/react/styles.css`) and is hidden when the device asks for less motion.
- **Sound: the music never stops** from the start tap to the end (`podium-music.ts`): a tense minor groove while waiting, a happy major groove for each reveal, a faster one with bells for the finale; the
  mood changes on the next bar. On top of it the effects of each part (`podium-sounds.ts`: timpani, snare roll, whoosh, brass, marimba, bells, whistle, boing, crowd, applause; the music is lowered a moment
  under a reveal). Every kid gets his own key and his own flourish (`variant` = the number of his step), so no two kids sound the same. All of it is made with Web Audio (`podium-synth.ts`): no sound
  files, works offline, silent where Web Audio is missing.
- **Automatic or by hand** (a choice on the start screen, and a switch ⏱ / 👆 in the header that can be flipped at any time): automatic moves on by itself (the times are `PODIUM_TIMES` in `src/react/hooks/usePodiumShow.ts`); by hand, each drum roll / climb still plays by itself, but after the kid is shown he stays until the servant taps the big "👆 المركز اللي بعده" button (the last one says "🏁 النتيجة النهائية"). Switching never restarts the sounds. It starts automatic.
- Automatic: "⏭ التالي" jumps ahead, 🔊 mutes, ✕ / Escape close it (which also stops the music).
- No extra reads: it uses what the ranking already loaded.
- Code: `src/react/screens/spiritual-notes-ranking/podium.ts` (the steps) and `podium-show/` (the screens), `src/react/hooks/usePodiumShow.ts` (the timer and what plays when),
  `src/react/lib/podium-{sounds,music,synth}.ts`. Tests: `PodiumShow.test.tsx`, `podium-logic.test.ts`, `podium-sounds.test.ts`, `SpiritualNotesRanking.test.tsx`.

## ⭐ Extra stars (given by the servant for a WHOLE week) and the 🎉 cheer show
- **Data:** `spiritualNotes/{kid}/weeks/{YYYY-MM-DD}` = `{ week, stars, updatedAt, updatedBy }`. The id is the **Friday** the week starts on (the week runs Friday to Thursday, like the points);
  `stars` is the extra stars the servant gave for that whole week, in halves (0, 0.5, 1 ... 6). Stars are **not points** (nothing in the points or the ranking reads them) and are not part of a day.
  Security rule (`firestore.rules`, `match /spiritualNotes/{childId}/weeks/{week}`): approved users read; create/update only with the fields `week`, `stars`, `updatedAt`, `updatedBy`, an id like `YYYY-MM-DD`,
  `week` equal to the id and `stars` one of the 13 values 0 to 6 in halves. **Deploy the rules (`firebase deploy --only firestore:rules`, or paste `firestore.rules` in the Firebase console and Publish)
  before a servant saves stars**, otherwise that save is refused. A migration to another backend needs the same collection and the same check (a number, a multiple of 0.5, 0 to 6).
- **Giving them:** in the kid's file (النوتة الروحية) the box "⭐ نجوم الأسبوع" shows the stars of the week of the open day (the same for all its days); − / + change them by half a star and
  "حفظ نجوم الأسبوع" saves them (it does not save the day, and "حفظ اليوم" does not touch them). Above the file, "نجوم آخر ٤ أسابيع" shows the total of the last 4 weeks, at most six (the six stars of the kid's card).
  One extra read per kid and per screen: `fetchKidStarWeeks(id, from, to)` (a range on the document id, the same 4 weeks as the points); `fetchKidsMonthData` returns it as `starWeeks`.
- **The cheer show** (statistics > النوتة الروحية > 🎉 عرض التشجيع): every kid that has points comes on his own (random order, picture and name), with no places, no points and no sentence, and at the end all together under one closing line.
  Under each kid's name are the six stars of the card, big and all dim; the ones he got (his stars of the last 4 weeks added up, at most six, a half star lit on its first half) light up one after the other, each with ONE entrance
  (`rx-star-in`: it spins and grows in with a flash) and then stays a plain star (no beat, no glow, no sparks). A kid without stars keeps the six dim ones.
  Code: `src/react/screens/spiritual-notes-ranking/cheer.ts` (the random order, the closing line `CHEER_CLOSING`), `cheer-show/` (the screens, `StarRow.tsx` the stars),
  `src/react/hooks/useCheerShow.ts` (the timer and the sounds, the same sounds as the winners show).
