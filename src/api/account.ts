// Checking a signed-in account: may this person use the app, and what do they see first? This used to live inside the
// `onAuthStateChanged` callback of the old login code, mixed with page changes. Now:
//   evaluateAccount()      pure: the account's data in, a AccountDecision out (every branch is unit-tested)
//   loadAccountDecision()  reads the account (Firestore, or the cached copy when offline) and evaluates it
// What to DO with a decision (show a notice, sign out, enter the app) is the sign-in screen's job (src/react/screens/auth/).
import type { User } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { resolveAccess, type AccountData } from '@/core/access';
import { gradeNamesOfAccess, hasNoAccess } from '@/core/access-config';
import { checkAccountSection } from '@/core/account-section';
import { db } from '@/core/firebase';
import { getDocFast, loadProfileCache } from '@/core/firestore-helpers';
import { SECTION, switchDeviceToSection } from '@/core/section';
import { getPhaseGradesForGrade, normalizePhaseGrades } from '@/core/session';
import { sendUnauthorizedAlert } from './email';
import type { Section } from '@/types/access';
import type { AccountDecision, SessionPatch, UserDoc } from '@/types/account';

const asSection = (value: unknown): Section => (value === 'girls' ? 'girls' : 'boys');

/** Has the person given the basic data we need (phone, address, birth date, study status)? Asked once, at the first sign-in. */
export function isProfileIncomplete(data: UserDoc | null | undefined): boolean {
  if (!data) {
    return true;
  }
  const hasPhone = (data.phones && data.phones.length > 0) || data.phone;
  if (!hasPhone || !data.dob || !data.address) {
    return true;
  }
  if (typeof data.graduated !== 'boolean') {
    return true;
  }
  if (data.graduated === false && (!data.college || !data.university)) {
    return true;
  }
  return false;
}

export interface EvaluateInput {
  user: { uid: string; email: string | null };
  /** the account's data: from Firestore, or the copy cached on this device; null when there is none */
  profile: UserDoc | null;
  /** the section this device is set to (boys / girls) */
  deviceSection: Section;
  /** set when this page was already reloaded once to switch section (stops a redirect loop) */
  redirectedTo: string | null;
  online: boolean;
}

export function evaluateAccount({ user, profile, deviceSection, redirectedTo, online }: EvaluateInput): AccountDecision {
  // an admin is an account whose role says so (the roles screen gives and takes the admin role)
  const isAdmin = profile?.role === 'admin';
  let role: string;
  let name: string;
  if (isAdmin) {
    role = 'admin';
    name = profile?.name || 'الأدمن';
  } else if (profile) {
    if (profile.status === 'pending') {
      return { kind: 'blocked', reason: 'pending' };
    }
    if (profile.status === 'rejected') {
      return { kind: 'blocked', reason: 'rejected' };
    }
    role = profile.role || 'deacon';
    name = profile.name || user.email || '';
  } else {
    // no record in Firestore and none cached: either an account made outside the app's own sign-up form (a security hole if we let it
    // in as an ordinary servant), or a real connection problem on a device that never signed in before. Never let it in by default.
    return { kind: 'blocked', reason: online ? 'unregistered' : 'unverifiable' };
  }

  // the old class / lead fields
  const phaseGrades = normalizePhaseGrades(profile?.phaseGrades || (profile?.isPhaseLead && profile?.grade ? getPhaseGradesForGrade(profile.grade) : [])) as string[];
  const { access, source } = resolveAccess({ ...profile, role } as AccountData);
  const session: SessionPatch = {
    currentUserRole: role,
    currentUserName: name,
    currentUserEmail: user.email,
    currentUserGrade: profile?.grade || null,
    currentUserIsLead: !!profile?.isLead,
    currentUserIsPhaseLead: !!profile?.isPhaseLead || (normalizePhaseGrades(profile?.phaseGrades) as string[]).length > 0,
    currentUserPhaseGrades: phaseGrades,
    access,
    accessSource: source,
  };

  if (!isAdmin && source === 'roles') {
    // with role-based access the roles decide the class(es); the old fields stay in the data only so a rollback keeps working
    session.currentUserGrade = gradeNamesOfAccess(access, deviceSection)[0] ?? null;
    session.currentUserIsLead = false;
    session.currentUserIsPhaseLead = false;
    session.currentUserPhaseGrades = [];
    if (hasNoAccess(access)) {
      return { kind: 'blocked', reason: 'no-access' };
    }
  }

  if (!isAdmin) {
    // every account except an admin belongs to ONE section; one who opens the other is sent to her own, and never gets into this one
    const check = checkAccountSection(role, profile, redirectedTo, source === 'roles' ? access : null, deviceSection);
    if (check.action === 'redirect') {
      return { kind: 'redirect-section', target: check.target };
    }
    if (check.action === 'deny') {
      return { kind: 'blocked', reason: 'wrong-section' };
    }
    // a servant without a class must not be handed one by default
    if (!session.currentUserGrade && session.currentUserPhaseGrades.length === 0) {
      return { kind: 'blocked', reason: 'no-class' };
    }
  }

  if (isProfileIncomplete(profile)) {
    return { kind: 'incomplete-profile', session, profile };
  }
  return { kind: 'enter', session, profile };
}

type DocSnapshot = { exists?: () => boolean; data: () => UserDoc } | null;

/**
 * Reads the account of a signed-in person and checks it (one Firestore document). Two things belong to the check itself, so they happen
 * here, once per check: an account of the other section gets this device switched to its section (the screen then reloads the page),
 * and an account that was made outside the sign-up form alerts the admin by email (only when online, so a bad connection does not
 * cause a false alarm).
 */
export async function loadAccountDecision(user: User): Promise<AccountDecision> {
  const snap = (await getDocFast(doc(db, 'users', user.uid))) as DocSnapshot;
  let profile: UserDoc | null = snap?.exists?.() ? snap.data() : null;
  if (!profile) {
    profile = (loadProfileCache(user.uid) as UserDoc | null) ?? null;
  } // offline fallback
  let redirectedTo: string | null = null;
  try { redirectedTo = sessionStorage.getItem('sectionRedirect'); } catch { /* private mode */ }
  const decision = evaluateAccount({
    user: { uid: user.uid, email: user.email },
    profile,
    deviceSection: asSection(SECTION),
    redirectedTo,
    online: navigator.onLine,
  });

  if (decision.kind === 'redirect-section') {
    if (!switchDeviceToSection(decision.target)) {
      return { kind: 'blocked', reason: 'wrong-section' };
    } // the browser refuses (private mode)
    try { sessionStorage.setItem('sectionRedirect', decision.target); } catch { /* private mode */ }
  } else if (decision.kind === 'blocked' && decision.reason === 'unregistered') {
    sendUnauthorizedAlert(user.email || '(بدون إيميل)', user.uid).catch((e) => console.warn('security alert not sent:', e));
  }
  return decision;
}
