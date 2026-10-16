# If the project ever moves to the Blaze plan

Status: **a wish list, nothing here is planned.** The project runs on the free Spark plan and everything below is optional.
Blaze is "pay as you go" (a card is needed) and keeps the same free amounts as Spark; you only pay for what goes over them. Set a
**budget alert** (Google Cloud console, Billing) the day you switch, so a mistake cannot turn into a surprise bill.

Written 2026-10-16. Prices and which feature needs which plan change: before relying on an item, check the current Firebase pricing page
and the console. Items marked (verify) are the ones I am least sure need Blaze.

## What changes by itself
- **No more hard stop at the free limits.** On Spark, passing 50,000 reads/day shows "Quota exceeded" (it happened on 2026-09-24). On Blaze
  the app keeps working and the extra reads are billed (very small amounts at this size). Keep the read-saving work anyway: it is what keeps the bill at zero.
- The free amounts stay: the same daily reads / writes and the 1 GB Firestore storage are still free.

## Things we could do (roughly in order of value)
1. **Photos in Firebase Storage** instead of base64 text in Firestore (`students.photo`, `users.photo`).
   Lighter lists (about 6-7 MB less per class load once every kid has a photo), photos cached by the browser, smaller memory use.
   Plan and steps: see the "Photos" item in `docs/TODO-CLEANUP.md`. Storage rules can limit who reads and writes each photo.
2. **Cloud Functions for the things the browser should not decide** (server code with admin rights):
   - Give roles as **custom claims** on the login (admin, cells), so the Firestore rules read the claim instead of looking documents up
     (fewer rule reads, and server-side access by class: see `docs/SECURITY-SECTIONS.md` and `docs/ROLES-DESIGN.md`).
   - Keep `users.access` (the snapshot) in step when a role changes, on the server, instead of the admin's browser writing it.
   - **Real deletion of an account** (Firebase Authentication user plus its data). From the app we can only delete the Firestore side.
   - Email to the admin when someone registers, from the server (today the browser sends it through EmailJS with its keys in the app).
   - Replace the two Cloudflare Workers (push notifications, assistant) with functions, so everything lives in one project. Optional: the workers work.
3. **Scheduled jobs** (a scheduled function, or Cloud Scheduler):
   - Prune old `activity_log` entries (older than about 90 days), as listed in `docs/TODO-CLEANUP.md`. A Firestore TTL policy can do the same with no code (verify).
   - A nightly / weekly **Firestore backup** (managed backup schedules and point-in-time recovery need Blaze (verify)); today backups are scripts run by hand into `backups/`.
   - The attendance / servant reminders as push notifications.
4. **Firebase Extensions** (they need Blaze): for example "Resize Images" (thumbnails for the photos in Storage), "Delete User Data".
5. **More than one environment** without worrying about free limits: a separate Firebase project for testing with real-size data.

## What does NOT need Blaze (so no reason to move for these)
Hosting with a custom domain, the preview channels (`npm run deploy:test`), Authentication (email / password), Firestore rules, Cloud Messaging,
App Check, and everything the app does today.

## Before switching
- Take a backup first (`backups/`), and write down the current monthly usage (console: Usage) to compare later.
- Set the budget alert and, if wanted, a hard cap by disabling billing automatically from a function (Google documents this).
- Decide who owns the billing account.
