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
"يلا نبدأ" (this tap also unlocks the browser's audio) → drum roll + "المركز التالت" → the name and points with confetti → the same for the second → the winner with a
crown, a glow, more confetti and a bigger fanfare → the finished podium (second · first · third) with "إعادة العرض" / "إغلاق".
- It moves on by itself (the times are `PODIUM_TIMES` in `src/react/hooks/usePodiumShow.ts`); "⏭ التالي" jumps ahead, 🔊 mutes, ✕ / Escape close it.
- The places are the ones of the list: kids with the same score share a place and the next one is skipped (1, 1, 3 shows the third, then the first with both names); a place nobody holds is not shown.
- No extra reads: it uses what the ranking already loaded.
- The sounds are made with the Web Audio API (`src/react/lib/podium-sounds.ts`): no sound files, works offline, silent where Web Audio is missing. The animations are CSS (`rx-*` in `src/react/styles.css`); the confetti is hidden when the device asks for less motion.
- Code: `src/react/screens/spiritual-notes-ranking/podium.ts` (the places) and `podium-show/` (the screens), `src/react/hooks/usePodiumShow.ts` (the timer). Tests: `PodiumShow.test.tsx`, `podium-logic.test.ts`, `SpiritualNotesRanking.test.tsx`.

## Data (a part of the students' data: one subcollection per student, nothing else is touched)
- `spiritualNotes/{studentId}/days/{YYYY-MM-DD}` = `{ day, prayerMorning, prayerNight, gospel (bool; old notes: string), mass, fast?, updatedAt, updatedBy }`
- `spiritualNotes/{studentId}/months/{YYYY-MM}` = `{ confession, updatedAt, updatedBy }`
- `studentId` is the id of the document in `students`. Documents are never deleted.
- Reads: nothing when the tab opens (the names are already loaded). Opening a kid reads that day, the month, his last 30 days and the
  days of the week/month for the points (about 70 documents at most). Saving writes 1 document (2 when the confession changed).

## Rules
`firestore.rules` has the two `match /spiritualNotes/...` blocks (before the catch-all). Rules are NOT deployed by the GitHub Pages build:
paste/deploy them yourself (`firebase deploy --only firestore:rules`, or Firebase Console > Firestore > Rules). Until then the tab shows
"مش مسموح بالنوتة الروحية".
Any approved servant can write any student's notes (the same trust the students collection has); the rules (`gospel` may be a bool, or the old string) check the shape of the
document, the date format and that `updatedAt` is the server time.

## Code
`src/api/spiritual-notes.ts` (backend) · `src/react/hooks/useSpiritualNotes.ts` · `src/react/screens/spiritual-notes/` (screen) ·
tab plumbing in `index.html`, `src/features/shell/tabs.ts`, `src/features/shell/app-shell.ts` · tests in `src/react/__tests__/`.
