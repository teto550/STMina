// Types of the roles / access design (docs/ROLES-DESIGN.md). Types only, no runtime code.

export type Gender = 'male' | 'female';
export type Section = 'boys' | 'girls';
export type Grade = 1 | 2 | 3 | 4 | 5 | 6;

/** A class: gender + grade, written `male:3`. Covers the kids AND the servants of that class. */
export type Cell = `${Gender}:${Grade}`;

/** `roles/{id}` in Firestore. */
export interface Role {
  id: string;
  name: string;
  admin: boolean;
  cells: Cell[];
}

/** A person of the servants list (`deacons/{id}`), the fields the access design adds or uses. */
export interface Person {
  id: string;
  name: string;
  gender: Gender;
  roleIds: string[];
  /** uid of the linked login, when the person has registered */
  uid?: string;
}

/** What a person may do: the union of the roles they hold. Stored on the account as a snapshot (`users/{uid}.access`). */
export interface Access {
  admin: boolean;
  cells: Cell[];
  sections: Section[];
}
