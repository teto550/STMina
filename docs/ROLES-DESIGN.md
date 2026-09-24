# Roles and access design (agreed decisions + plan)

Status: **design only, nothing implemented.** Decisions below come from the user (2026-09-25). Open questions are at the end.

## 1. Decisions
1. One checkbox per item: "can see" and "can manage" are the same thing. No extra permission levels.
2. A person may have several roles. The admin UI must make it easy to see who is in each role and to add/remove many people at once.
3. A servant's **class and audience live only in roles** (never per servant). Moving a servant, or the yearly graduation, means editing the role once.
   The servant's **gender stays on the person** (a fact about them, needed before any role is known: default section, sanity checks).
4. Admins are a role flag (`admin`). Two admins exist and both can repair access from the Firebase console, so lock-out is a low risk;
   we still keep one cheap guard (the UI refuses to remove the last admin).
5. Do the ID migration together with roles, but only through **new fields** that do not break production; keep a clean-up to-do list
   (`docs/TODO-CLEANUP.md`) and revisit it regularly.
6. Grades 1 and 2: boys and girls share the same class, with female servants only. The boys are `male`; they appear in the girls' section
   for grades 1-2 and move to the boys' section when they reach grade 3. Kids keep their gender, only the class changes.
7. At login: a male servant goes to the boys' section, a female servant to the girls' section (by the person's gender).
   The "switch section" menu item is visible only to admins and to people whose roles span both sections (grades 1-2 do NOT count as
   mixed, because they all belong to the girls' section).
8. The servants directory (the "الخدام/الخادمات" chip next to the class chips) is visible only to admins.

## 2. Concepts
- **Cell** = gender + grade number, written `male:3`, `female:1` ... Kids and servants are both described by cells.
- **Section** (boys / girls) of a KID cell comes from one small config, not from the kid's gender alone:
  `MIXED_GRADES = [1, 2]` -> a kid of grades 1-2 (male or female) is in the **girls'** section; from grade 3, male -> boys, female -> girls.
  A SERVANT's section is simply their gender (male -> boys, female -> girls); servants of grades 1-2 must be female.
  The config is a constant in code (`src/core/access-config.ts`) so it is easy to change; a Firestore override can come later.
- **Person** = a servant in the roster (`deacons` collection). May or may not have a login yet. Holds name, gender, roles.
  An account (`users`) is linked to its person (`deaconId`).
- **Role** = `{ id, name, admin: boolean, kids: [cells], servants: [cells] }`.
  Examples: "3rd grade boys servant" = kids [`male:3`]; "3rd grade boys coordinator" = kids [`male:3`] + servants [`male:3`];
  "3rd and 4th boys" = kids [`male:3`,`male:4`] (+ servants); "All boys" = all boys cells + all male-servant cells; "Grade 1" = kids
  [`female:1`,`male:1`] + servants [`female:1`]; "Admin" = `admin: true` (everything, both sections).
- **Access** of a person = union of their roles: `{ admin, kids:Set, servants:Set, sections:Set }`.

## 3. Where membership lives (recommendation: on the person)
The roster has ~49 people but only ~29 accounts, and people without an account are still assigned kids and appear in class lists.
If classes live only in roles, the roles must apply to **people**, not just accounts. So: `deacons/{id}.roleIds`, and
`users/{uid}.deaconId` links a login to its person. A login's access = the roles of its person. Admin accounts that are not in the
roster get a person record created for them (migration step).

## 4. Data model (all additive; old fields stay until clean-up)
| Data | New field | Notes |
| --- | --- | --- |
| `roles/{id}` (new) | `name`, `admin`, `kids[]`, `servants[]`, `createdAt`, `updatedAt` | edited only by admins |
| `deacons/{id}` | `gender` (done), `roleIds[]`, `uid` | person; `grade`/`section` become legacy |
| `users/{uid}` | `deaconId`, `access` (computed snapshot) | snapshot lets login and (later) security rules read one document |
| `students` | `gender` (all existing = male), `cell` (`male:4`), `deaconId` | `section` stays (denormalised, recomputed at promotion) |
| later: `attendance`, `deaconAttendance`, `parts_distribution` | `cell` / `deaconId` | only needed for server-side rules |

Saving a role writes the role and refreshes `access` of every member in ONE atomic batch, so changes apply immediately.

## 5. Screens (React islands, admin-only menu entry "إعدادات الأدمن" -> "المستخدمين والأدوار")
1. **Roles matrix.** Rows = roles, columns grouped under sticky headers: Kids (Girls 1-6 | Boys 3-6) and Servants (Female 1-6 | Male 3-6) and
   an Admin column. For grades 1-2 there is a single linked checkbox "girls & boys" (they are one class). Create / rename / duplicate /
   delete role (a role with members cannot be deleted). Save = batch.
2. **People & roles.** For each role: its members, with search; tick many people and "add to role" / "remove from role". Per person: role chips.
   Shows gender, whether they have a login, and warnings (male servant in a grades 1-2 role, person without any role).
3. **Consistency check** (later): kids assigned to a servant whose roles do not cover the kid's class; roles without members.
4. **Year rollover helper** (later): "move this role up one grade" (cells shift 3 -> 4; grade 6 drops), and the existing promote-kids tool also
   recomputes each kid's `cell` and `section` (boys leave the girls' section at 2 -> 3).

## 6. What each part of the app uses
- Class chips and data: only the classes in the person's kid cells; students are loaded per cell (`where cell == ...`, one query per cell).
- In-class servants tab: servants of the active class are those whose roles include that class; seeing OTHER servants needs servant cells.
- Servants directory: admin only. Section switch menu: admin or mixed-section access. Everything else follows the cells.
- Admin-only stays admin-only (imports, passwords, promotion/cleanup, activity log, roles) unless a decision below says otherwise.

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

## 9. Open questions (asked to the user)
See the end of the conversation of 2026-09-25 and the list in `docs/TODO-CLEANUP.md` -> "Questions".
