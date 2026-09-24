// Servants are linked by ID (docs/ID-MIGRATION.md), the name is only for display. Records that carry a `deaconId` are resolved to the
// servant's CURRENT name through the servants list held in memory; records that still only have the old name field keep working
// (dual mode), and so does a screen that runs before the servants list is loaded (it falls back to the stored name).
import { state } from '@/core/state';

interface Linked { deacon?: string; deaconId?: string }
interface RosterEntry { id: string; name: string; section?: string }

let cachedFor: RosterEntry[] | null = null;
let cachedSize = -1;
let byId = new Map<string, RosterEntry>();

function index(): Map<string, RosterEntry> {
  const raw: RosterEntry[] = state.ALL_DEACONS_RAW || [];
  if (raw !== cachedFor || raw.length !== cachedSize) { byId = new Map(raw.map((d) => [d.id, d])); cachedFor = raw; cachedSize = raw.length; }
  return byId;
}

/** The servant's current display name for a record (kid, ...): by id when it has one, else the stored name. */
export function deaconNameOf(item: Linked | null | undefined): string {
  if (!item) return '';
  if (item.deaconId) { const d = index().get(item.deaconId); if (d) return d.name; }
  return item.deacon || '';
}

/** Does this record belong to the servant with this (current) name? */
export const isDeaconOf = (item: Linked | null | undefined, name: string): boolean => !!name && deaconNameOf(item) === name;

/** The roster id for a typed/selected servant name in a section (null when there is no single match; nothing is guessed). */
export function deaconIdOfName(name: string, section: string = 'boys'): string | null {
  const wanted = (name || '').replace(/\s+/g, ' ').trim();
  if (!wanted) return null;
  const hits = [...index().values()].filter((d) => d.name === wanted && (d.section || 'boys') === section);
  return hits.length === 1 ? hits[0]!.id : null;
}
