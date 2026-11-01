# النوتة الروحية (spiritual notes)

A tab next to الحضور / المخدومين for ONE class of the boys' section (the trial): `سنة رابعة ابتدائي`. The list of classes is
`SPIRITUAL_NOTES_GRADES` in `src/core/notes-access.ts`; add a class there to open the tab for it. The girls' section never has it.

## What it does
- The tab lists the kids of the open class with a search box (spelling variants of the same name match).
- Opening a kid opens his file: pick a day (the week runs from Friday to Thursday, with "الأسبوع اللي فات / الأسبوع الجاي" to move between weeks, or any date), tick الصبح / بليل, write the gospel, tick القداس,
  الصوم (shown on Wednesday and Friday only) and the month's الاعتراف, then "حفظ اليوم". Below: the last 30 days he has something in.
- Any servant of the class (and admins) can write, like the other class tabs (`canManageGrade`).

## Data (a part of the students' data: one subcollection per student, nothing else is touched)
- `spiritualNotes/{studentId}/days/{YYYY-MM-DD}` = `{ day, prayerMorning, prayerNight, gospel, mass, fast?, updatedAt, updatedBy }`
- `spiritualNotes/{studentId}/months/{YYYY-MM}` = `{ confession, updatedAt, updatedBy }`
- `studentId` is the id of the document in `students`. Documents are never deleted.
- Reads: nothing when the tab opens (the names are already loaded). Opening a kid reads that day, the month, and his last 30 days
  (at most about 32 documents). Saving writes 1 document (2 when the confession changed).

## Rules
`firestore.rules` has the two `match /spiritualNotes/...` blocks (before the catch-all). Rules are NOT deployed by the GitHub Pages build:
paste/deploy them yourself (`firebase deploy --only firestore:rules`, or Firebase Console > Firestore > Rules). Until then the tab shows
"مش مسموح بالنوتة الروحية".
Any approved servant can write any student's notes (the same trust the students collection has); the rules check the shape of the
document, the date format and that `updatedAt` is the server time.

## Code
`src/api/spiritual-notes.ts` (backend) · `src/react/hooks/useSpiritualNotes.ts` · `src/react/screens/spiritual-notes/` (screen) ·
tab plumbing in `index.html`, `src/features/shell/tabs.ts`, `src/features/shell/app-shell.ts` · tests in `src/react/__tests__/`.
