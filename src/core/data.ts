// @ts-nocheck
// Lazy data loading. Nothing is read from Firestore when the app starts: each screen asks for what it needs, and every
// loader remembers what is already in memory (and, through getDocsTtl, in the local cache) for a few minutes.
import { state } from '@/core/state';
import { SECTION } from '@/core/section';
import { clearReadCache } from '@/core/firestore-helpers';
import { loadStudents } from '@/features/students/students';
import { loadDeaconsList, loadDeaconUsersMap } from '@/features/servants/deacons';
import { loadAttendance, listenTodayAttendance } from '@/features/attendance/attendance';
import { loadDeaconAttendance } from '@/features/servants/deacon-attendance';

const TTL_MS = 5 * 60 * 1000;
const loadedAt = {};       // what is in memory -> when it was loaded
let studentsKey = null;    // which class the students in memory belong to
let todayListenerDate = null;

const fresh = k => loadedAt[k] && Date.now() - loadedAt[k] < TTL_MS;
const stamp = k => { loadedAt[k] = Date.now(); };

// students of the ACTIVE class (only that class is kept in memory)
export async function ensureStudents() {
  const grade = state.activeGrade;
  const key = `${SECTION}:${grade || '*'}`;
  if (studentsKey === key && fresh('students')) return;
  await loadStudents();
  if (state.activeGrade === grade) { studentsKey = key; stamp('students'); } // if the class changed meanwhile, the newer load owns the data
}

// all servants (every class) and, for managers, the accounts map
export async function ensureDeacons() {
  if (fresh('deacons') && state.ALL_DEACONS_RAW.length) return;
  await loadDeaconsList();
  stamp('deacons');
}
export async function ensureDeaconUsers() {
  if (fresh('deaconUsers')) return;
  await loadDeaconUsersMap();
  stamp('deaconUsers');
}

// attendance history: 'recent' (last ~90 days: enough for "absent last time", statistics) or 'full' (export, import, cleanup)
export async function ensureAttendance(level = 'recent') {
  const have = state.attendanceLevel;
  if (have === 'full' && fresh('attendance')) return;
  if (have === 'recent' && level === 'recent' && fresh('attendance')) return;
  await loadAttendance(level);
  stamp('attendance');
}

export async function ensureDeaconAttendance() {
  if (fresh('deaconAttendance')) return;
  await loadDeaconAttendance();
  stamp('deaconAttendance');
}

// live listener for today's attendance (started the first time it is needed, then kept until logout)
export function ensureTodayListener() {
  const today = new Date().toISOString().slice(0, 10);
  if (state.todayAttendanceUnsub && todayListenerDate === today) return;
  listenTodayAttendance();
  todayListenerDate = today;
}

// what the attendance screen, the students screen, the voice assistant... all need
export async function ensureCoreData() {
  await Promise.all([ensureStudents(), ensureDeacons()]);
  ensureTodayListener();
}

// "refresh data" button: forget everything so the next load reads from the server
export function refreshAllData() {
  clearReadCache();
  Object.keys(loadedAt).forEach(k => delete loadedAt[k]);
  studentsKey = null;
  state.attendanceLevel = null;
}
export function forgetLoaded(...keys) { keys.forEach(k => delete loadedAt[k]); if (keys.includes('students')) studentsKey = null; }
