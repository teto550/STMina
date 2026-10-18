import { useEffect, useState, type FC } from 'react';
import { createPortal } from 'react-dom';
import { savePhoto, parsePhotoTarget, type PhotoTarget } from '@/api/photos';
import { PhotoManager } from '@/react/components/photo/photo-manager';
import { Avatar } from '@/react/components/ui/avatar';

type Slot = { id: number; el: HTMLElement; name: string; src: string; size: number; accent: boolean; target: PhotoTarget | null };

// The old screens write lists as HTML text. Where such a list shows a person it writes a placeholder
//   <span data-avatar data-name="..." data-src="..." data-size="42" data-photo-target="student:ID"></span>
// and this host (mounted once) draws the React <Avatar> inside every placeholder that appears, and forgets the ones that go away.
//  - a placeholder with a photo, or with `data-photo-target` (the person's photo may be changed), opens the <PhotoManager> when tapped;
//  - after a photo is saved or deleted the host updates every avatar of that person and fires a `photo-changed` event
//    (detail: { kind, id, photo }) so the old page can update the data it holds. Nothing is read from Firestore again.
let nextId = 1;
const ids = new WeakMap<HTMLElement, number>();

function readSlots(): Slot[] {
  const slots: Slot[] = [];
  document.querySelectorAll<HTMLElement>('[data-avatar]').forEach((el) => {
    if (!ids.has(el)) {
      ids.set(el, nextId++);
      el.replaceChildren(); // the plain fallback (the first letter) is replaced by the avatar
    }
    slots.push({
      id: ids.get(el)!,
      el,
      name: el.dataset.name ?? '',
      src: el.dataset.src ?? '',
      size: Number(el.dataset.size) || 42,
      accent: el.dataset.accent === '1',
      target: parsePhotoTarget(el.dataset.photoTarget),
    });
  });
  return slots;
}

const sameSlots = (a: Slot[], b: Slot[]): boolean => a.length === b.length && a.every((s, i) => s.id === b[i]!.id && s.name === b[i]!.name && s.src === b[i]!.src && s.target?.id === b[i]!.target?.id);

const keyOf = (t: PhotoTarget) => `${t.kind}:${t.id}`;

/** Draws the Avatar inside every `[data-avatar]` placeholder of the page, and the photo manager when one is tapped. */
const AvatarHost: FC = () => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [changed, setChanged] = useState<Record<string, string>>({}); // photos saved in this session, by person
  const [active, setActive] = useState<Slot | null>(null);

  useEffect(() => {
    let frame = 0;
    const scan = () => {
      frame = 0;
      const next = readSlots();
      setSlots((cur) => {
        if (sameSlots(cur, next)) {
          return cur;
        }
        if (next.some((s) => !cur.some((c) => c.id === s.id))) {
          setChanged({}); // the old page redrew its lists with the data it holds: that is up to date
        }
        return next;
      });
    };
    const schedule = () => {
      if (!frame) {
        frame = requestAnimationFrame(scan);
      }
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    scan();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  const photoOf = (s: Slot): string => (s.target && changed[keyOf(s.target)] !== undefined ? changed[keyOf(s.target)]! : s.src);

  const store = async (s: Slot, photo: string) => {
    if (!s.target) {
      return;
    }
    await savePhoto(s.target, photo);
    setChanged((cur) => ({ ...cur, [keyOf(s.target!)]: photo }));
    document.dispatchEvent(new CustomEvent('photo-changed', { detail: { kind: s.target.kind, id: s.target.id, photo } }));
  };

  return (
    <>
      {slots.map((s) =>
        createPortal(
          <Avatar name={s.name} src={photoOf(s)} size={s.size} accent={s.accent} onClick={photoOf(s) || s.target ? () => setActive(s) : undefined} />,
          s.el,
          String(s.id),
        ),
      )}
      {active && (
        <PhotoManager
          name={active.name}
          photo={photoOf(active)}
          editable={!!active.target}
          onSave={(photo) => store(active, photo)}
          onRemove={() => store(active, '')}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
};

export default AvatarHost;
