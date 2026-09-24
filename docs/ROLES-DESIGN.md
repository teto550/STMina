# Roles and access design (agreed decisions + plan)

Status: **design only, nothing implemented.** Decisions below come from the user (2026-09-25). Open questions are at the end.

## 1. Decisions (updated 2026-09-25, second round)
1. **One checkbox per class**, and it means everything. A class cell covers the kids AND the servants of that class: a servant of a class can do
   anything in that class and sees everything about it, including its servants, and nothing outside it. There are no separate "servants"
   columns and no separate "manage" level. (Cross-class operations, e.g. moving kids up a grade, are an open question below.)
2. A person may have several roles. The admin UI must make it easy to see who is in each role and to add/remove many people at once.
3. A servant's **class lives only in roles** (never per servant). Moving a servant or the yearly graduation = edit the role once.
   The servant's **gender is a separate field on the person**; a role cell is gender + grade ("3rd grade boys" = `male:3`), and a role cell's
   gender must match the servant's gender. A servant assigned to grade 1-2 is treated and shown as female.
4. Lock-out protection is NOT wanted (two admins can repair access in the Firebase console). No guard.
5. IDs and roles are done together, only through **new fields**; the clean-up list is `docs/TODO-CLEANUP.md` and is revisited regularly.
6. Grades 1-2: boys and girls share one class with female servants only; the boys are `male`, shown in the girls' section for grades 1-2, and
   move to the boys' section at grade 3 (only their class changes).
7. At login a male servant starts in the boys' section and a female servant in the girls' section (by the person's gender). The "switch
   section" menu item is visible only to admins and to people whose roles span both sections (grades 1-2 do not count as mixed).
8. The servants directory (the chip next to the class chips) is visible only to admins; the in-class servants tab shows the class's servants
   to every servant of that class.
9. **Access is loaded right after login and before anything is shown**, and can be cached for a longer period (see 3b below).
10. **Roles apply to the people in the servants list** (the roster), whether or not they already have a login.
11. **An admin can add another admin** from the admin screen (see 6b).
12. **All new screens are built in React** (`docs/REACT.md`); existing screens are migrated incrementally when they change substantially,
    each one verified before the next. The roles/users admin screen is the first React screen. It is **mobile first** (mostly used on
    phones) and desktop friendly.

## 2. Concepts
- **Cell** = gender + grade number, written `male:3`, `female:1` ... Both kids and servants of a class are covered by its cell.
- **Section** (boys / girls) of a KID cell comes from one small config, not from the gender alone:
  `MIXED_GRADES = [1, 2]` -> a kid of grades 1-2 (male or female) is in the **girls'** section; from grade 3, male -> boys, female -> girls.
  A SERVANT's section is their gender (male -> boys, female -> girls); servants of grades 1-2 must be female.
  The config is a constant in code (`src/core/access-config.ts`), easy to change; a Firestore override can come later.
- **Person** = a servant in the roster (`deacons` collection). May or may not have a login. Holds name, gender, roles.
  An account (`users`) is linked to its person (`deaconId`).
- **Role** = `{ id, name, admin: boolean, cells: [cells] }`. Examples: "3rd grade boys" = [`male:3`]; "3rd and 4th boys" = [`male:3`,`male:4`];
  "Grade 1" = [`female:1`,`male:1`] (one linked checkbox "girls and boys"); "All boys" = every boys cell; "Admin" = `admin: true`.
- **Access** of a person = union of their roles: `{ admin, cells:Set, sections:Set }`.

### 3b. Loading access after login (cached)
Login -> read the person's access snapshot (one document, stored on the account) -> only then show the app. It is cached in the browser
(localStorage) so a reload is instant and works offline; the cache is validated in the background with one read, and role changes apply on the
next load (or as soon as the validation returns). Cache lifetime: to be confirmed with the user (proposal: valid 24 hours, revalidated on every load).

## 3. Where membership lives (recommendation: on the person)
The roster has ~49 people but only ~29 accounts, and people without an account are still assigned kids and appear in class lists.
If classes live only in roles, the roles must apply to **people**, not just accounts. So: `deacons/{id}.roleIds`, and
`users/{uid}.deaconId` links a login to its person. A login's access = the roles of its person. Admin accounts that are not in the
roster get a person record created for them (migration step).

## 4. Data model (all additive; old fields stay until clean-up)
| Data | New field | Notes |
| --- | --- | --- |
| `roles/{id}` (new) | `name`, `admin`, `cells[]`, `createdAt`, `updatedAt` | edited only by admins |
| `deacons/{id}` | `gender` (done), `roleIds[]`, `uid` | person; `grade`/`section` become legacy |
| `users/{uid}` | `deaconId`, `access` (computed snapshot) | snapshot lets login and (later) security rules read one document |
| `students` | `gender` (all existing = male), `cell` (`male:4`), `deaconId` | `section` stays (denormalised, recomputed at promotion) |
| later: `attendance`, `deaconAttendance`, `parts_distribution` | `cell` / `deaconId` | only needed for server-side rules |

Saving a role writes the role and refreshes `access` of every member in ONE atomic batch, so changes apply immediately.

## 5. Screens (React, admin-only menu entry "إعدادات الأدمن"; mobile first, desktop friendly)
Mobile (default): a screen with two tabs, "الأدوار" and "الأشخاص".
1. **Roles list**: one card per role (name, class chips, member count); "+ دور جديد".
2. **Role editor** (full screen on a phone): name, an "admin" switch (hides the grid), then a small grid, rows = grades and columns = girls | boys
   (grades 1-2 are one wide "girls and boys" checkbox), big touch targets, a line "changes apply to N people now", Save / Cancel, and the
   members of the role.
3. **People**: search + filters (all, no role, boys, girls, by role); rows with a checkbox, name, gender, role chips and login status; when rows
   are selected a bottom bar offers "add to role" / "remove from role" for all of them. "+ add admin" (see 6b).
Desktop (wider screens): the same data as one **matrix**: rows = roles, columns = Girls 1-2 (together), 3-6 | Boys 3-6 | Admin, sticky header
rows and a sticky first column, with a side panel listing and editing the members of the selected role.
Later: consistency check, "move this role up one grade" for the yearly graduation.

### 6b. Adding an admin
A client cannot create another person's login, so: "add admin" creates (or picks) a **person** (name, gender, email) and gives them the Admin
role. When that person registers or logs in with that email, the account links to the person and gets admin access. An existing person can
simply be given the Admin role.

## 6. What each part of the app uses
- Class chips and data: only the classes in the person's cells; students are loaded per cell (`where cell == ...`, one query per cell).
- In-class servants tab: every servant of the class sees the class's servants. Servants directory: admin only.
- Section switch menu: admin or mixed-section access. Roles/users admin screen: admin only.
- Anything inside a class is allowed for its servants (decision 1); operations that reach into another class stay open questions.

## 7. Migration plan (safe order, rollback = redeploy the old code)
The live site still runs the OLD code, so every data step must be harmless to it: only new fields, dry-run scripts, backups.
1. Config + types (`access-config.ts`, TypeScript types for role/cell/access). No data.
2. Data, additive: `students.gender/cell`, people get `roleIds:[]`, accounts get `deaconId` (link by name, once, with a report of unmatched names),
   admin accounts get a person. Scripts are dry-run first, written for the user to run.
3. Code in dual mode: `core/access.ts` computes access from roles when present, otherwise from today's fields (role/lead/grade/gender), so nobody
   loses access. New code **writes both** the old name fields and the new id fields until clean-up (so rolling back never breaks).
4. Admin screens; the user recreates today's setup as roles and assigns people; verify on the test channel with real accounts.
5. Cut over the live site (GitHub Pages) when confident. Then backfill `cell`/`section`, switch queries, tighten the Firestore rules
   (see `docs/SECURITY-SECTIONS.md`), then the clean-up list.

## 8. Risks
- Two clients (old live code, new code) writing at the same time create documents without the new fields: the new code must tolerate
  missing fields (derive them), and the backfill is re-run at cut-over.
- Firestore rules need queries constrained like the rules (one query per cell); tested in the emulator before deploy.
- Roles edited by mistake affect many people at once: a confirmation with the number of affected people, and an "undo" via the role's previous value.

## 9. Decisions from the third round (2026-09-25)
- **Cache:** access is cached for 24 hours; nothing needs to be instant, a page reload is fine.
- **No role yet:** a person who logs in without any role sees a "no access yet" screen. Roles can be assigned to people who have not
  registered yet; they get their access as soon as their account links to the person.
- **Deleting a role:** only a role with **no members** can be deleted. If it has members the screen blocks the delete and asks the admin to
  move the members to another role first.
- **Kids' passwords (`student_secrets`):** revised - they stay as today: the import screen and the display in the student profile are kept,
  but **only admins** may see or import them (with roles: the admin role; the current "phase lead may read one" exception goes away).
  The data stays in Firestore and may later be linked with an external source. Low priority, not to be over-engineered.
- **Actions across classes** (promoting kids to the next grade, bulk imports, attendance clean-up): postponed. Graduation is still months
  away, so nothing is decided; see `docs/TODO-CLEANUP.md` section C. Until then those stay as they are today.

## 9b. Notes from the user (2026-09-25, after the list of agreed changes)
- **Only admins assign roles.** Adding or removing a person to/from a role is always done by an admin, in the admin screen.
- **The admin screen is the same in the boys' and the girls' section.** It is not scoped by the current section: it always shows everything.
- **The picker for adding people to a role lists ALL servants, male and female**, with a local (in-browser, no reads) search box and a
  gender filter: الكل / خدام (male) / خادمات (female). The same search + gender filter is on the People tab.

## 10. Still open
Nothing that blocks the start. Cross-class actions are postponed (see the to-do list).
