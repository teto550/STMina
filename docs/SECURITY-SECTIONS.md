# Access by section (boys / girls), gender and class

## Rules the user asked for
- A servant who is female and not an admin may only use the girls' section, is sent straight to it when she logs in, and only
  sees her own class. (Male servants: boys' section.) Admins may use both sections.
- `gender` on servants holds ONLY `'male'` or `'female'`.

## What is enforced today (in the app, client side)
| Rule | Where |
| --- | --- |
| `gender` decides the section: female -> girls, male -> boys (older accounts fall back to the `section` field, then boys) | `accountSection()` in `core/section.ts` |
| On login a non-admin is redirected to her section and the device is switched (guard against loops: `sectionRedirect` in sessionStorage; if the switch fails she is refused with a message) | `checkAccountSection()` + `onAuthStateChanged` in `auth.ts` |
| The "switch section" menu item is hidden for non-admins and `toggleAppSection()` refuses them | `app-shell.ts`, `section.ts` |
| A non-admin without a class is refused (never handed the first class by default) | `auth.ts` |
| A servant only sees her class (students are queried by class; the class bar and the directory are managers-only; `switchActiveGrade` refuses other classes) | existing code |
| Registration asks "ذكر / أنثى"; the choice switches the device to that section and stores `gender` + `section` | `index.html`, `section.ts`, `auth.ts` |
| New servants added by an admin get `gender` from the section they are added in | `servants.ts` |
| `?section=girls` / `?section=boys` in the URL points the device at that section (a direct girls' link) | `section.ts` |

Data check (2026-09-24): none of the 32 accounts had a `section` or `gender`; 6 admins, 23 approved servants (all have a class),
3 rejected. `tools/firestore/set-gender.cjs` sets `gender: 'male'` on all existing `users` and `deacons` (run by the user).

## What is NOT protected yet (be honest about it)
Everything above lives in the browser. A technically skilled logged-in servant could still ask Firestore directly for data of
the other section or another class, because the Firestore security rules (kept in the Firebase console, not in this repo) only
check "approved user" for students, attendance and servants' attendance, and let anyone read `deacons` (needed for the
registration list). Real protection needs rules like:

```
function myGender()  { return myDoc().get('gender', 'male'); }
function mySection() { return myGender() == 'female' ? 'girls' : 'boys'; }
match /students/{id} {
  allow read: if isApproved() && (isAdmin() ||
    (resource.data.get('section','boys') == mySection() &&
     (resource.data.grade == myDoc().get('grade','') || resource.data.grade in myDoc().get('phaseGrades', []))));
}
// same idea for attendance, deaconAttendance, parts_distribution, part_notifications; and a rule that only allows
// gender in ['male','female'] on create/update of users and deacons.
```
Catch: for LIST queries Firestore requires the query itself to be constrained the way the rule is (it will not filter results),
and older documents have no `section` field (missing = boys), so `where('section','==','boys')` would miss them.
So the safe order is:
1. Back up, then add `section: 'boys'` to every old document (students, attendance, deaconAttendance, deacons, users,
   parts_distribution, activity_log) with a script like the other tools.
2. Add `where('section','==',SECTION)` to the app's queries (and `where('grade', ...)` where the rule needs it).
3. Test the rules in the Rules Playground / emulator, then deploy them. A wrong rule locks everybody out, so do it in a quiet moment.
Not started; needs the user's go-ahead. The same applies to the other Firebase project.
