import type { Access, Cell, Gender } from '@/types/access';

/** A servant of the roster (`deacons/{id}`) as the admin screen sees it. */
export interface AdminPerson {
  id: string;
  name: string;
  gender: Gender;
  roleIds: string[];
  /** set when the person was created from the admin screen ("+ أدمن"); the account links when this email logs in */
  email?: string;
}

/** A login (`users/{uid}`). */
export interface AdminAccount {
  uid: string;
  name: string;
  email: string;
  /** legacy admin flag, still what the security rules read */
  role: string;
  deaconId?: string;
  access?: Access;
}

export interface AdminRole {
  id: string;
  name: string;
  admin: boolean;
  cells: Cell[];
}

export interface AdminData {
  roles: AdminRole[];
  people: AdminPerson[];
  accounts: AdminAccount[];
}

/** One document write of a batch; `merge` writes only the given fields. */
export type WriteOp =
  | { col: 'roles' | 'deacons' | 'users'; id: string; data: Record<string, unknown>; merge: true }
  | { col: 'roles' | 'deacons' | 'users'; id: string; data: Record<string, unknown>; merge: false }
  | { col: 'roles' | 'deacons' | 'users'; id: string; delete: true };
