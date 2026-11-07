# النوتة الروحية (spiritual notes)

A tab next to الحضور / المخدومين for ONE class of the boys' section (the trial): `سنة رابعة ابتدائي`. The list of classes is
`SPIRITUAL_NOTES_GRADES` in `src/core/notes-access.ts`; add a class there to open the tab for it. The girls' section never has it.

## What it does
- The tab lists the kids of the open class with a search box (spelling variants of the same name match).
- Opening a kid opens his file: pick a day (the week runs from Friday to Thursday, with "الأسبوع اللي فات / الأسبوع الجاي" to move between weeks, or any date), tick الصبح / بليل, tick الإنجيل (قرأ — only that he read, the verse is not written), tick القداس,
  الصوم (shown on Wednesday and Friday only) and the month's الاعتراف, then "حفظ اليوم". Below: the last 30 days he has something in.
- Any servant of the class (and admins) can write, like the other class tabs (`canManageGrade`).

## Points (shown at the top of every kid's file: اليوم / الأسبوع / الشهر)
`POINTS` in `src/react/screens/spiritual-notes/logic.ts`: صلاة الصبح 5 · صلاة بليل 5 · الإنجيل 15 · القداس 20 · الصوم 10 (Wednesday and Friday only) · الاعتراف 25 (once a month).
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
"يلا نبدأ" (this tap also unlocks the browser's audio) → a drum roll, a 3-2-1 and "المركز التالت" → the kid appears with his picture, his FIRST TWO NAMES only, his points and a cheer
→ the same for the second → the winner with a crown, a glow, more confetti and a bigger fanfare → the finished podium (second · first · third) with "إعادة العرض" / "إغلاق".
- **One kid per step.** Kids with the same score share a place and come one after the other in that place (the second one gets a short drum roll and "ومعاه كمان واحد!"). The places are the ones
  of the list: a tie skips the next place (1, 1, 3 shows the third, then both first-place kids); a place nobody holds is not shown.
- **Pictures:** the photo of the kid's card (`photo`, passed from `renderNotesStats` in `src/features/dashboard/stats.ts`); a kid without one (or whose photo does not load) gets a cartoon face on a
  coloured background, a different one for every step (`faceOf` in `podium.ts`).
- **Looks:** the background changes with the part (suspense = dark and tense, each place its own colours, finale = purple) and never stops moving: turning rays and shapes (stars, balloons, drums,
  trophies...) floating up, rings and stars bursting around the picture, shape confetti, a wiggling cheer. The decoration is CSS (`rx-*` in `src/react/styles.css`) and is hidden when the device asks for less motion.
- **Sound: the music never stops** from the start tap to the end (`podium-music.ts`): a tense minor groove while waiting, a happy major groove for each reveal, a faster one with bells for the finale; the
  mood changes on the next bar. On top of it the effects of each part (`podium-sounds.ts`: timpani, snare roll, whoosh, brass, marimba, bells, whistle, boing, crowd, applause; the music is lowered a moment
  under a reveal). Every kid gets his own key and his own flourish (`variant` = the number of his step), so no two kids sound the same. All of it is made with Web Audio (`podium-synth.ts`): no sound
  files, works offline, silent where Web Audio is missing.
- It moves on by itself (the times are `PODIUM_TIMES` in `src/react/hooks/usePodiumShow.ts`); "⏭ التالي" jumps ahead, 🔊 mutes, ✕ / Escape close it (which also stops the music).
- No extra reads: it uses what the ranking already loaded.
- Code: `src/react/screens/spiritual-notes-ranking/podium.ts` (the steps) and `podium-show/` (the screens), `src/react/hooks/usePodiumShow.ts` (the timer and what plays when),
  `src/react/lib/podium-{sounds,music,synth}.ts`. Tests: `PodiumShow.test.tsx`, `podium-logic.test.ts`, `podium-sounds.test.ts`, `SpiritualNotesRanking.test.tsx`.
