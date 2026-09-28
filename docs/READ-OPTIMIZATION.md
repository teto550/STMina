# Firestore read optimization

Why: the free Spark plan allows 50,000 document reads per day for the whole project, and spike days (Fridays) reached
150k-250k. Firestore bills a read for every document returned by the server (a live listener bills every document in its
first result and every document that changes afterwards); reads served from the local cache are free.

## Findings (2026-09-24)
| # | Where | Problem | Cost |
| --- | --- | --- | --- |
| 1 | `servants/online.ts` activity feed | query had NO `limit` (comment said "latest 100"): every open of the tab read the whole `activity_log` (~2,800 docs, growing) and streamed every new log entry until the app closed | ~2.8k+ reads per open |
| 2 | `core/presence.ts` | a write to `users/{uid}` every 25 s per open device for `lastActive`, which nothing displays any more | thousands of writes per device per day |
| 3 | `students/students.ts` `loadStudents` | read all students of the section then kept only the active class | 144 reads instead of ~36 |
| 4 | `shell/app-shell.ts` `switchActiveGrade` | re-read servants, students and ALL attendance on every class switch | ~300+ reads per switch |
| 5 | `attendance/attendance.ts` `loadAllAttendance` | reads the whole `attendance` collection at every start (81 docs today, ~40+ per Friday, so thousands per start within a year) | grows forever |
| 6 | `servants/deacon-attendance.ts` | reads the whole `deaconAttendance` collection whenever the servants/online tab opens (66 docs, ~60 per week of growth) | grows forever |
| 7 | `shell/tabs.ts` | every tab switch writes an `activity_log` doc ("فتح خانة ...") which then also feeds every live activity feed | write noise |

## Done (see C12 in docs/PORTING.md)
1. Activity feed: now an on-demand viewer, 20 per page, date range on the server, no live listener. (was: whole log + live)
2. Heartbeat removed entirely (no `lastActive` writes). Tab-open logging removed.
3. Students: only the active class is fetched. 4. Switching class reloads only the open screen.
5. Attendance history is lazy: 'recent' (90 days) or 'full', only when a screen needs it; profile queries one student.
6. Servants' attendance loads on demand (dashboard, servants directory, assistant) through the short cache.
7. New home screen: the app reads nothing until a screen is opened. Every loader goes through a 5-minute cache that lives
   in MEMORY only (a page reload always fetches again; logging out clears it).
8. Activity viewer: filters (servant, type, date, class) are applied by the server when "apply" is pressed and for every
   following page; the next page loads when scrolling to the bottom. Needs `firestore.indexes.json` deployed.
9. `users.lastActive` is written once per page load (no heartbeat).
10. All non-Firebase HTTP calls go through one axios instance (`src/core/http.ts`).

## Estimated reads now (measure with `__reads` after the quota resets)
- Start-up: about 3-5 (profile, settings, pending requests for managers). Home screen: 0.
- A servant opening the attendance screen: about 36 students + today's attendance (a few dozen) + one read per new mark.
- A manager opening statistics: students + servants + the last 90 days of attendance (roughly 1-2k, cached 5 minutes).
- Activity viewer: 20 per click (up to 100 when filters hide most entries).
Expected: typical days far below 50,000; a heavy Friday in the tens of thousands, not 150-250k.

## Still possible if needed
- Narrow 'recent' from 90 to 60 days; load only the servant's own class attendance (needs a class field on attendance docs).
- `updatedAt` on students for delta syncs. A retention script for `activity_log` (>90 days) is optional now that reads no
  longer depend on the log size.

## How to measure
`npm run dev`, log in, then in the console: `__reads` (total and per collection). Compare with the estimates above.

## Where should the activity log live?
Volume today: about 2,800 entries in 2.5 months (~40 a day), almost all writes. That is far inside the free limits
(20,000 writes/day) and, now that the log is read 20 at a time and only on demand, reads are negligible. The quota problem was
never the log itself but the unlimited read and the heartbeat. So cost is not a reason to move it.

The real limit is what Firestore can do: it cannot search inside text, and a text filter cannot be combined with
"newest first"; every combination of filters needs a composite index; keeping only the last N days needs a script
(Firestore TTL is not free-tier). That is why the viewer offers servant / type / date / class filters but no text search.

Options:
1. **Keep it in Firestore (recommended for now).** It is your least important feature. Log fewer things, optionally prune
   entries older than 90 days with a script, done.
2. **Cloudflare D1 through your existing Worker (recommended if you ever want real search).** Free tier: 5 million reads and
   100,000 writes per day, 5 GB. SQL gives text search (`LIKE`), any filter combination, page-by-page and retention
   (`DELETE ... WHERE ts < date('now','-90 day')`) with no Firestore quota. Needs: a Worker route that verifies the Firebase
   ID token (the push worker already does this), a D1 table, and the app posting log lines through the axios instance.
   Roughly 1-2 hours; old entries need not be migrated.
3. Not recommended: Google Sheets or another vendor (extra account, weaker auth), Cloud Logging/BigQuery (needs the paid
   plan), logs kept only on each device (useless to the admin).
