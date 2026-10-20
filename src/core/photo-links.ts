// Matching the photo-link sheet (SERIAL_NUMBER + AVATAR_FULL_URL) to the kids, without touching the backend (pure, tested).
// The link is written once to `students/{id}.photoLink` and never changes (firestore.rules). Anything doubtful is reported, never guessed.

export type PhotoSheetRow = { kidId: string; url: string };
export type PhotoKid = { id: string; name?: string; kidId?: unknown; photoLink?: unknown };

export type PhotoDoubt = { kidId: string; url: string; reason: 'sharedUrl' | 'unknownHost' | 'sameIdTwoUrls'; detail: string; approvable: boolean };

export type PhotoPlan = {
  sheetRows: number;
  writes: { studentId: string; name: string; kidId: string; url: string }[];
  same: number;                                                    // the kid already has exactly this link
  lockedDifferent: { name: string; kidId: string; current: string; sheet: string }[];
  doubtful: PhotoDoubt[];                                          // not written unless the admin accepts it (sameIdTwoUrls can never be accepted)
  badRows: { line: number; kidId: string; url: string; reason: string }[];
  notFound: string[];                                              // IDs in the sheet that no kid has
  duplicateKids: { kidId: string; names: string[] }[];             // one ID on more than one kid: skipped
};

export const KNOWN_PHOTO_HOSTS = ['firebasestorage.googleapis.com', 'i.imgur.com'];

const ID_HEADS = ['serial_number', 'id', 'kidid', 'serial'];
const URL_HEADS = ['avatar_full_url', 'url', 'avatar', 'photo', 'photo_url', 'photolink'];

export const normKidId = (v: unknown): string => (typeof v === 'number' ? String(v) : String(v ?? '').trim());

/** Reads the rows of the first sheet that has an ID column and a link column (matched by header name, not by position). */
export function parsePhotoSheet(sheets: unknown[][][]): { rows: { line: number; kidId: string; url: string }[] } | null {
  for (const aoa of sheets) {
    const hi = aoa.findIndex((r) => (r || []).some((c) => ID_HEADS.includes(String(c ?? '').trim().toLowerCase())));
    if (hi === -1) {
      continue;
    }
    const head = (aoa[hi] || []).map((c) => String(c ?? '').trim().toLowerCase());
    const cId = head.findIndex((h) => ID_HEADS.includes(h));
    const cUrl = head.findIndex((h) => URL_HEADS.includes(h));
    if (cId === -1 || cUrl === -1) {
      continue;
    }
    const rows: { line: number; kidId: string; url: string }[] = [];
    for (let i = hi + 1; i < aoa.length; i++) {
      const r = aoa[i];
      if (!r || r.every((c) => c == null || String(c).trim() === '')) {
        continue;
      }
      rows.push({ line: i + 1, kidId: normKidId(r[cId]), url: String(r[cUrl] ?? '').trim() });
    }
    return { rows };
  }
  return null;
}

function hostOf(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.hostname : null;
  } catch {
    return null;
  }
}

export function buildPhotoPlan(
  rows: { line: number; kidId: string; url: string }[],
  kids: PhotoKid[],
  approved: Set<string> = new Set(),                               // kidIds whose doubt the admin accepted
): PhotoPlan {
  const plan: PhotoPlan = { sheetRows: rows.length, writes: [], same: 0, lockedDifferent: [], doubtful: [], badRows: [], notFound: [], duplicateKids: [] };

  // 1) unusable rows
  const good: { kidId: string; url: string }[] = [];
  for (const r of rows) {
    if (!r.kidId) {
      plan.badRows.push({ ...r, reason: 'مفيش ID' });
    } else if (!r.url) {
      plan.badRows.push({ ...r, reason: 'مفيش لينك' });
    } else if (!hostOf(r.url)) {
      plan.badRows.push({ ...r, reason: 'اللينك مش https صالح' });
    } else {
      good.push({ kidId: r.kidId, url: r.url });
    }
  }

  // 2) the same ID twice: same link = one row, different links = doubt that cannot be accepted
  const urlsById = new Map<string, Set<string>>();
  good.forEach((r) => (urlsById.get(r.kidId) ?? urlsById.set(r.kidId, new Set()).get(r.kidId)!).add(r.url));
  const ids = [...urlsById.keys()];
  const clash = new Set(ids.filter((id) => urlsById.get(id)!.size > 1));
  clash.forEach((id) => plan.doubtful.push({ kidId: id, url: [...urlsById.get(id)!].join('  |  '), reason: 'sameIdTwoUrls', detail: 'نفس الـ ID مكرر في الشيت بلينكين مختلفين', approvable: false }));

  // 3) one link on several IDs (placeholder photo?) and links on an unusual host
  const idsByUrl = new Map<string, string[]>();
  ids.filter((id) => !clash.has(id)).forEach((id) => {
    const u = [...urlsById.get(id)!][0]!;
    (idsByUrl.get(u) ?? idsByUrl.set(u, []).get(u)!).push(id);
  });
  const doubtOf = new Map<string, PhotoDoubt>();
  idsByUrl.forEach((list, url) => {
    list.forEach((id) => {
      if (list.length > 1) {
        doubtOf.set(id, { kidId: id, url, reason: 'sharedUrl', detail: `نفس اللينك على ${list.length} IDs (غالبًا صورة افتراضية)`, approvable: true });
      } else if (!KNOWN_PHOTO_HOSTS.includes(hostOf(url) ?? '')) {
        doubtOf.set(id, { kidId: id, url, reason: 'unknownHost', detail: `الموقع ${hostOf(url)} مش من المواقع المعروفة`, approvable: true });
      }
    });
  });

  // 4) match with the kids by the exact ID
  const kidsById = new Map<string, PhotoKid[]>();
  kids.forEach((k) => {
    const id = normKidId(k.kidId);
    if (id) {
      (kidsById.get(id) ?? kidsById.set(id, []).get(id)!).push(k);
    }
  });
  ids.filter((id) => !clash.has(id)).forEach((id) => {
    const url = [...urlsById.get(id)!][0]!;
    const found = kidsById.get(id) ?? [];
    if (!found.length) { plan.notFound.push(id); return; }
    if (found.length > 1) { plan.duplicateKids.push({ kidId: id, names: found.map((k) => k.name || k.id) }); return; }
    const kid = found[0]!;
    const current = typeof kid.photoLink === 'string' ? kid.photoLink : '';
    if (current) {
      if (current === url) {
        plan.same++;
      } else {
        plan.lockedDifferent.push({ name: kid.name || kid.id, kidId: id, current, sheet: url });
      }
      return;
    }
    const doubt = doubtOf.get(id);
    if (doubt && !approved.has(id)) { plan.doubtful.push(doubt); return; }
    plan.writes.push({ studentId: kid.id, name: kid.name || kid.id, kidId: id, url });
  });
  return plan;
}
