// @ts-nocheck
import { state } from '@/core/state';
import { renderTodayList } from '@/features/attendance/attendance';

// A person's photo is entirely React (src/react/components/photo/photo-manager.tsx): see it, zoom it, take / pick / crop / delete it.
// The old screens only draw a placeholder where a person's picture belongs, and react to the `photo-changed` event.

const attr = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// The picture of a person (kid or servant, in a list or a profile) is the ONE React <Avatar>, drawn by the 'avatar-host' screen into
// this placeholder (until it is there, or if it cannot load, the first letter shows). Tapping it opens the photo manager.
//  - photoTarget ('student:ID' / 'servant:UID') lets the photo be changed and says where it is saved; without it the photo can only be seen
export function avatarPlaceholder(name, photo, size, { accent = false, photoTarget = '' } = {}) {
  const fontSize = Math.round(size * 0.42);
  const fallback = `<span class="student-avatar" style="width:100%;height:100%;font-size:${fontSize}px">${attr((name || '').trim()[0] || '؟')}</span>`;
  return `<span data-avatar data-name="${attr(name)}" data-src="${attr(photo)}" data-size="${size}"${accent ? ' data-accent="1"' : ''}${photoTarget ? ` data-photo-target="${attr(photoTarget)}"` : ''} style="display:inline-flex;width:${size}px;height:${size}px;flex-shrink:0">${fallback}</span>`;
}

// the kid's picture next to the name in the lists
export function avatarBox(s, size = 42) {
  return avatarPlaceholder(s.name, s.photo, size, { photoTarget: `student:${s.id}` });
}

// the photo field of the "add kid" / "edit kid" forms (React 'photo-field'); the form reads state.newPhotoData / state.editPhotoData when saved
export function mountPhotoField(mode, photo) {
  const initial = photo || '';
  state[mode + 'PhotoData'] = initial;
  window.openReactScreen('photo-field', document.getElementById(mode + '-photo-field'), {
    photo: initial,
    onChange: (next) => { state[mode + 'PhotoData'] = next; }
  });
}

window.clearNewPhoto = () => mountPhotoField('new', '');

// a kid's photo was saved or deleted (by the photo manager): keep the list in memory in step and redraw from it (no new read)
document.addEventListener('photo-changed', (e) => {
  const { kind, id, photo } = e.detail || {};
  if (kind !== 'student') return;
  const idx = state.allStudents.findIndex(s => s.id === id);
  if (idx !== -1) state.allStudents[idx].photo = photo;
  if (typeof renderTodayList === 'function') renderTodayList();
  if (typeof onManualSearch === 'function') onManualSearch();
  if (typeof renderStudentsList === 'function') renderStudentsList();
  if (typeof renderDeaconList === 'function') renderDeaconList();
  if (typeof renderStats === 'function') renderStats();
  const modal = document.getElementById('profile-modal');
  const open = document.getElementById('prof-edit-id');
  if (modal && modal.style.display === 'block' && open && open.value === id) window.openProfile(id);
});
