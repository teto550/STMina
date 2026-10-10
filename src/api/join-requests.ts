// Join requests: servants who registered and wait for approval (`users` with status 'pending').
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '@/core/firebase';
import { findApprovalPatch } from '@/core/access-link';
import { logActivity } from '@/core/presence';
import type { Section } from '@/types/access';
import type { UserDoc } from '@/types/account';

export interface JoinRequest extends UserDoc {
  id: string;
  createdAt?: { seconds: number };
}

export interface JoinRequestScope {
  section: Section;
  /** the classes the reader may decide on; empty = all of them */
  grades: string[];
}

/** The pending requests of one section, narrowed to the classes the reader manages. Rejects when Firestore cannot be read. */
export async function fetchJoinRequests({ section, grades }: JoinRequestScope): Promise<JoinRequest[]> {
  const snap = await getDocs(query(collection(db, 'users'), where('status', '==', 'pending')));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as UserDoc) }) as JoinRequest)
    .filter((u) => (u.section || 'boys') === section)
    .filter((u) => grades.length === 0 || grades.includes(u.grade ?? ''));
}

/**
 * Approves a request. The account is linked to its person of the servants list and gets that person's access; only an admin may write
 * the access snapshot and the admin flag (a class lead just records the link). Linking never blocks the approval.
 */
export async function approveJoinRequest(uid: string, isAdmin: boolean): Promise<void> {
  let link: Record<string, unknown> = {};
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      link = await findApprovalPatch(snap.data());
    }
    if (!isAdmin) {
      link = link.deaconId ? { deaconId: link.deaconId } : {};
    }
  } catch (e) {
    console.warn('could not link the account to its person:', e);
  }
  await updateDoc(doc(db, 'users', uid), { status: 'approved', ...link });
  logActivity('وافق على طلب خادم', uid);
}

export async function rejectJoinRequest(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { status: 'rejected' });
  logActivity('رفض طلب خادم', uid);
}
