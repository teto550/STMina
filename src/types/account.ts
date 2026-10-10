// The shape of a signed-in person's account and the result of checking it. Types only, no runtime code.
import type { Access, Section } from './access';

/** `users/{uid}` in Firestore (every field is optional: old accounts miss many of them). */
export interface UserDoc {
  name?: string;
  email?: string;
  role?: string;
  /** 'pending' | 'approved' | 'rejected' */
  status?: string;
  grade?: string | null;
  isLead?: boolean;
  isPhaseLead?: boolean;
  phaseGrades?: string[] | string | null;
  gender?: string;
  section?: string;
  access?: { admin?: boolean; cells?: string[]; sections?: string[] } | null;
  phones?: string[];
  phone?: string;
  address?: string;
  dob?: string;
  graduated?: boolean;
  college?: string;
  university?: string;
}

/** What the old app reads from its shared `state` object about the signed-in person; written when the person is let in. */
export interface SessionPatch {
  currentUserRole: string;
  currentUserName: string;
  currentUserEmail: string | null;
  currentUserGrade: string | null;
  currentUserIsLead: boolean;
  currentUserIsPhaseLead: boolean;
  currentUserPhaseGrades: string[];
  access: Access;
  accessSource: 'roles' | 'legacy';
}

/** Why a signed-in account cannot use the app (yet). The screen shows a message for each. */
export type BlockedReason =
  | 'pending' // registered, waiting for an admin to approve it
  | 'rejected' // an admin refused it
  | 'unregistered' // no record: made outside the app's own sign-up form
  | 'unverifiable' // no record found, but we are offline, so we cannot tell
  | 'no-access' // approved, but no admin has given it a class yet
  | 'wrong-section' // belongs to the other section and this device cannot be switched
  | 'no-class'; // a servant without a class

/**
 * The outcome of checking a signed-in account:
 *  - blocked: cannot come in (see BlockedReason)
 *  - redirect-section: belongs to the other section; the device has been switched, the page must reload
 *  - incomplete-profile: allowed, but must first finish their data
 *  - enter: allowed in
 */
export type AccountDecision =
  | { kind: 'blocked'; reason: BlockedReason }
  | { kind: 'redirect-section'; target: Section }
  | { kind: 'incomplete-profile'; session: SessionPatch; profile: UserDoc | null }
  | { kind: 'enter'; session: SessionPatch; profile: UserDoc | null };
