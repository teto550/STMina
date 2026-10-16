# Testing checklist (nothing below has been tested against real data yet)

Why: the read-reduction work (home screen, lazy loading, short cache, activity viewer, axios) was written while the free
daily Firestore quota was used up, so it was only checked by build, static checks and a fake-state browser run.
**Start of the next working session: remind the user to go through this list**, then update it.

## 0. Before anything else
- [ ] Deploy the activity-log indexes (a few minutes to build; Firebase console -> Firestore -> Indexes must say "Enabled"):
      `firebase deploy --only firestore:indexes`. Without them the activity viewer shows an "index" warning.
- [ ] Check the free quota is back (Firebase console -> Firestore -> Usage), or the plan was upgraded.
- [ ] `npm run dev`, log in on http://localhost:5173. In the console `__reads` counts documents fetched from the server.

## 1. Start-up and home screen
- [ ] After login the home screen shows (class name, tiles, refresh button) and `__reads.total` is about 0-5.
- [ ] No tab is selected by default; the manager-only tiles (متابعة) only show for admins/leads.
- [ ] Reload the page: the app re-fetches (the short cache does NOT survive a reload).

## 2. Data per screen (note `__reads` before/after each)
- [ ] Attendance: students of the class only (~36) + today's attendance. Mark someone present: it appears at once and on a second device.
- [ ] Students tab: list, add student, edit, delete, stars, photo. The servant dropdowns are filled.
- [ ] Servants DIRECTORY (the "🙏 الخدام" chip next to the classes): opens alone (no home tiles), lists all servants, the attendance tab (Sunday school / servants' meeting) works, closing returns to where you were; reachable from the home screen and after switching class.
- [ ] Servants tab: list, pending requests at the top, filters (attended / absent / visit / birthday), a servant's page shows "attended/absent last time".
- [ ] Stats tab: all four sub-tabs show sensible numbers (uses the last 90 days of attendance).
- [ ] Parts tab loads; adding a part still works (notifications are known to be blocked by the rules).
- [ ] Student profile: attendance count, last date and the list of dates are right (loaded per student).
- [ ] Dashboard (servants tab): opens and shows numbers; export to Excel; import attendance and import students (admin).
- [ ] Voice assistant: switch on from the home screen, record attendance for a student and for a servant.

## 3. Class switching (admin / leads)  <- the reported concern
- Note: in the boys data all 144 students are in class 4, so classes 3, 5 and 6 legitimately show no students.
- [ ] On the home screen switch class, then open Attendance: the students must be the NEW class.
- [ ] On an open tab switch class: the tab reloads with the new class' data. Switch A -> B -> A quickly: no mixed data.
- [ ] The home screen label and the top bar show the current class.

## 3b. Gender / section access (needs a female test account)
- [ ] Run the gender script first: `node tools/firestore/set-gender.cjs` (dry run), then `--apply --limit 1`, then `--apply`.
- [ ] Register a new servant on the girls' side (`/?section=girls`, or choose "أنثى" in the form): the account gets `gender: 'female'`,
      `section: 'girls'`; an admin approves her; she logs in from the BOYS site and lands directly in the girls' section.
- [ ] She cannot see the "switch section" menu item; she only sees her class; the class bar and the servants directory are not shown to her.
- [ ] A male servant logging in on a device set to girls lands in the boys' section. An admin can still switch freely.
- [ ] An account without a class is refused with a clear message. Registration list of classes/servants matches the chosen section.

## 4. Short cache (5 minutes, memory only)
- [ ] Open a tab, go to home, open it again within 5 minutes: `__reads` does not grow. After 5 minutes it re-reads.
- [ ] Home -> "تحديث البيانات" forces fresh reads. Logging out clears everything (log in as someone else: no stale data).

## 5. Activity viewer (managers)
- Verified once in dev with real data (2026-09-25): first open fills within ~2 s without switching tabs; scrolling to the bottom loads the next batch. Cost seen: ~180 reads for the first 22 entries, ~100 more per next batch (about 3/4 of the raw entries are hidden by the client-side checks: admin actions, other section). Idea if it matters: filter `role == 'deacon'` on the server (one more composite index).
- [ ] Opens with 20 entries; scrolling to the bottom loads the next 20 with a spinner at the bottom; the end shows "آخر النتائج".
- [ ] Servant / type / date filters only apply when pressing "تطبيق" (also for the next pages); "مسح" resets.
- [ ] Deleting one entry works. No free-text search on purpose (see docs/READ-OPTIMIZATION.md).

## 6. Other
- [ ] `users/{uid}.lastActive` updates once per page load (Firestore console), never continuously.
- [ ] Voice assistant "ask AI" question and the new-servant push notification (both now use the axios instance, `src/core/http.ts`).
- [ ] Offline: mark attendance without network, then reconnect: it syncs.
- [ ] Girls account: data and theme are per section; login screen stays blue.
- [ ] Deploy to the test channel (`npm run deploy:test`) and repeat sections 1-3 there.

## 7. Measure on a real Friday
- [ ] Firebase console -> Firestore -> Usage: daily reads should be far below 50,000. If not, see "Still possible" in docs/READ-OPTIMIZATION.md.

## Known open items (not part of this test)
- `part_notifications` has no security rule (notifications blocked). ID-based links plan: docs/ID-MIGRATION.md.
- Verify the "مستر" rename left 0 occurrences (read-only scan) once the quota allows.

## Roles work (2026-09-24/25)
- [ ] Deploy the rules first: `firebase deploy --only firestore:rules` (adds `roles`, locks `users.deaconId/access` to admins).
- [ ] Log in as an admin and as a normal servant on the test channel: everything works as before (access is derived from today's fields;
      `state.access` / `state.accessSource` can be checked in the console in dev).
- [ ] The 4 accounts that could not be linked by name (David Ayman, Mario Yasser Fadel Fam, ابرام سامح منصور سعد, الأدمن) are linked in the admin screen once it exists.

## Roles: what to test with real accounts (2026-09-25)
Use two extra accounts (one servant, one new registration) and your admin. Give the servant a role in "المستخدمين والأدوار" first.
- [ ] Servant with a role (say أولاد رابعة): logs in, starts in the boys' section, sees only that class (no class chips unless the role has several classes), no 🙏 الخدام chip, no switch-section item, and DOES see the class's servants in the الخدام tab.
- [ ] Servant with several classes: the class chips show only those classes.
- [ ] Girl servant with a grade 1-2 role: starts in the girls' section, sees the class of boys and girls together.
- [ ] Servant whose account is linked but has no role and no snapshot: still works as before (old fields). A servant whose LAST role was removed (snapshot with no classes): sees "لسه مفيش صلاحيات".
- [ ] Admin: switch-section item and 🙏 الخدام chip still there. Admin role given to a new person: register with that email, admin approves the request, the account becomes an admin (👑) after login.
- [ ] Approving a pending servant as admin links the account to the person (users.deaconId) and copies the role access.
- [ ] Add a kid in the boys' section (gets gender male + cell), and in the girls' section grade 1 (the ولد/بنت choice appears; grade 3 does not show it).
- [ ] Kids' passwords: only the admin sees them (a phase lead no longer does). Rules are deployed (2026-09-25).
- [ ] Rename a servant (edit screen and admin screen): kids, attendance and parts follow.

## The React login screen (2026-10-10) - needs a real account, I cannot sign in for you
- [ ] Open the test link logged out: the login screen appears right after the splash (no blank flash), looks the same as before.
- [ ] Sign in as an admin and as a servant: works, the app opens. A wrong password shows "بيانات خاطئة، حاول تاني" and the ✕ closes it.
- [ ] Sign out, sign in again: the button works again and the password field is empty.
- [ ] Accounts that cannot come in see a screen with the reason and a "خروج" button (they stay signed in until they press it): pending ("في انتظار الموافقة"), rejected, not registered (an account that exists only in Firebase Auth; the admin also gets the security email once EmailJS is configured), wrong section (when the device cannot be switched), no class, and "no access yet" (approved but no class). An account of the OTHER section instead reloads straight into its own section.
- [ ] "خادم جديد": the class list matches the section, the name list shows that class's servants, fill everything, send: the confirmation shows, the form empties, the admin gets the email/push, and the account appears as pending.
- [ ] Registering with an email that already exists says "الإيميل ده مسجل بالفعل".
- [ ] Change "النوع" to خادمه: the page reloads in the girls section and comes back on the "خادم جديد" tab.
- [ ] Slow or no network: the loading picture shows, and after 7 seconds the login form appears with a "connection problem" warning.
- [ ] Reload while signed in: the loading picture, then the app (no flash of the login form). Sign out from the app's menu: the login form comes back, with the password field empty.
- [ ] Registering: the new account must NOT show the loading picture or the "not registered" message while the request runs; at the end the form shows the confirmation. The admin gets the email (now sent through EmailJS's web API, not the old script).
- [ ] The eye in the password field (login and "خادم جديد") shows and hides what you typed; the browser's own password-manager fill still works.
- [ ] Error / confirmation boxes (login, registration, admin screens, rename) have a ✕ that closes them; the "saved" box in the roles screen also closes itself after a few seconds.
- [ ] Admins now come ONLY from their role (`users.role = 'admin'`, given by the roles screen): sign in with each of your admin accounts and check they still get the admin menu. (An account that was admin only because its email matched the old `config/settings.adminEmail` is no longer an admin.)

## Join requests popup (2026-10-10, React) - needs a pending account
- [ ] Servants screen: the "طلبات انضمام ›" card shows the number and opens a popup with each request (name, class, email, phone, address, birth date, study, date).
- [ ] ✓ قبول: the request disappears, the card number drops, the servant can sign in (and is linked to their person / roles as before).
- [ ] ✕ رفض asks "أكيد؟" on the second tap, then the request disappears and that account is rejected.
- [ ] A class lead sees only the requests of their own classes; the admin sees all classes in the servants screen (the count is loaded when the screen opens, no need to open a class first) and the active class elsewhere.
- [ ] The old list at the top of the "الخدام" list tab is gone; the `?approve=` link from the admin email still approves.

## Servants screen: class filter + React list (2026-10-10)
- [ ] Above the "الحضور | الخدام" tabs there is a row of chips: الكل + the classes (girls section also has أولى and تانية).
- [ ] Picking a class narrows the attendance list (both "مدارس الأحد" and "اجتماع الخدام") and the "الخدام" list; the choice is kept when you switch tabs; "الكل" clears it. The day's present counter still counts everyone.
- [ ] The filter works together with the name search; opening the screen again starts on "الكل".
- [ ] The "الخدام" tab (now React) shows the same rows and counts as before; tapping a row opens the servant's profile.

## Dashboard button: sections popup (2026-10-16, after merging main)
- [ ] Reloading the app shows NO popup.
- [ ] "📊 الداشبورد" opens the sections popup (the long list of checkboxes) straight away: the dashboard now covers every class (main's change), so there is no class to pick first (the `class-picker` screen still exists, unused).
- [ ] "اعرض الداشبورد" keeps the popup open with "جاري التحميل…" until the dashboard is ready; a failed load shows an error and stays open.

## Photo: camera or gallery popup + black-image fix (2026-10-16) - test on a real phone
- [ ] New kid form, edit kid form and tapping the letter avatar of a kid without a photo: each asks "إضافة صورة" -> "من الكاميرا" / "من المعرض" (closing the popup does nothing), then opens the camera or the gallery.
- [ ] Take several photos with the camera (iPhone and Android, portrait and landscape): none comes out black or half black, and the rotation is right.
- [ ] A transparent PNG / screenshot from the gallery gets a white background (not black).
- [ ] If a photo really cannot be read the toast says so ("الصورة طلعت سودا أو ناقصة...") instead of saving a black picture.

## Photos: one component for everything (2026-10-16) - test on a real phone
Everything about a photo is ONE React component (`src/react/components/photo/photo-manager.tsx`), used by the avatars of kids and servants (lists and profiles) and by the photo of the add-kid / edit-kid forms.
- [ ] Tap an avatar WITHOUT a photo: the camera / gallery popup. Pick one: the photo is saved and the popup closes (no extra taps).
- [ ] Tap an avatar WITH a photo: the photo opens full screen, with three icons on top (camera, gallery, delete) and X to close. Pinch to zoom, drag to move, double-tap to zoom in / out.
- [ ] Camera / gallery icon on top replaces the photo; the delete icon asks once ("تحذف الصورة؟") then deletes. Lists and profile update at once.
- [ ] Deleting or changing a photo costs ONE write and no extra reads (check `__reads` before / after).
- [ ] Servants: my own photo (👤 profile) and, as admin, any registered servant's; a servant I may not edit opens the photo view-only (no icons).
- [ ] Add-kid and edit-kid forms: tap the picture to add / view / change / delete; the photo is saved with the rest of the form.
- [ ] ⚙️ -> "الإعدادات" (a full screen) -> "✂️ قص الصورة بعد اختيارها" (off by default; saved on my account, so it follows me to another phone). When ON: after picking, the crop screen shows with a centred square already selected: "تم" keeps it (one tap), corners resize, "حر" frees the shape, "إلغاء" goes back. When OFF: no extra step.
- [ ] Camera photos never come out black or half black (earlier entry).

## Attendance: "back to the search box" option (2026-10-16)
- [ ] ⚙️ -> الإعدادات -> "الحضور" -> "🔍 الرجوع لخانة البحث بعد تسجيل الحضور": ON by default (saved on the account, so it follows the person to another phone).
- [ ] ON: kids attendance (search a name, tap to mark) and servants attendance (both types) clear the search box and focus it again after each mark (as before).
- [ ] OFF: marking someone does NOT clear the search box, does NOT focus it and the page does NOT scroll back: scroll the full list of a class and mark people one after another.

## Update check (2026-10-16)
- [ ] Deploy a build, open the app on a phone (installed shortcut), deploy ANOTHER build, then bring the app back to the foreground (or wait up to 30 minutes): a bar "🆕 فيه تحديث جديد للتطبيق" appears at the bottom; "تحديث الآن" loads the new build; "✕" hides it for that build. It never reloads by itself.
- [ ] ⚙️ -> الإعدادات -> "التطبيق": shows the running build's date; "تحقق من التحديث" says "إنت على آخر نسخة" or offers "تحديث الآن"; offline it says it cannot reach the server.
- [ ] `version.json` is next to index.html in the deployed site and is never served from the cache (Firebase Hosting header `no-cache`; the service worker skips it).

## Firestore rules: a servant editing their own account (2026-10-16)
Found and fixed: a new account has no `isLead` field, and the old self-edit rule read it, which is an ERROR in rules, so EVERY self-edit of a normal servant was
denied (the "complete your data" page failed with "حدث خطأ"; the settings preferences and the servant photo would have failed too). Exact error from the emulator:
`PERMISSION_DENIED: evaluation error ... Property isLead is undefined on object`. The rules now use `.get('isLead', false)`; deployed 2026-10-16.
- [ ] `npm run test:rules` (local emulators, project `demo-stmina`, never the real project) passes 9/9: sign-up, "complete your data", preference, own photo, and the five
      escalations that must stay denied (isLead, role, status, access, isPhaseLead). The project's firebase-tools needs Java 21; on a Mac with Java 17 run the same with
      the global one: `firebase emulators:exec --only auth,firestore --project demo-stmina "EXPECT=new node tools/rules-tests/users-self-edit.mjs"` (global v13).
- [ ] With a real new account on the test channel: register, get approved, sign in: the "complete your data" page saves and lets you in (the error now also shows its code).
