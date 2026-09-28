// @ts-nocheck
import { state } from '@/core/state';
import { db } from '@/core/firebase';
import { renderTodayList } from '@/features/attendance/attendance';

// بيبني مربع الصورة/الحرف اللي بيتحط جنب اسم المخدوم في القوائم:
// لو عنده صورة يعرضها (ودوسة عليها تكبّرها)، ولو مالوش يعرض حرف اسمه ودوسة عليه ترفع صورة له فورًا
export function avatarBox(s, size = 42) {
  const fontSize = Math.round(size * 0.42);
  if (s.photo) {
    return `<div style="position:relative;width:${size}px;height:${size}px;flex-shrink:0">
      <div class="student-avatar" style="width:100%;height:100%;padding:0;overflow:hidden">
        <img src="${s.photo}" style="width:100%;height:100%;object-fit:cover;cursor:zoom-in" onclick="event.stopPropagation();openLightboxFor('${s.id}')">
      </div>
    </div>`;
  }
  return `<div style="position:relative;width:${size}px;height:${size}px;flex-shrink:0">
    <div class="student-avatar" style="width:100%;height:100%;font-size:${fontSize}px;cursor:pointer" onclick="event.stopPropagation();triggerQuickPhoto('${s.id}')" title="ارفع صورة">${s.name.trim()[0] || '؟'}</div>
    <div style="position:absolute;bottom:-2px;left:-2px;background:var(--accent);border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-size:9px;pointer-events:none;box-shadow:0 0 0 2px var(--surface)">📷</div>
  </div>`;
}

window.triggerQuickPhoto = (id) => {
  state.quickPhotoTargetId = id;
  document.getElementById('quick-photo-input').click();
};

window.handleQuickPhotoSelect = async (event) => {
  const file = event.target.files[0];
  event.target.value = '';
  const id = state.quickPhotoTargetId;
  state.quickPhotoTargetId = '';
  if (!file || !id) return;
  try {
    const dataUrl = await compressImage(file);
    const { doc, updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(db, 'students', id), { photo: dataUrl });
    const idx = state.allStudents.findIndex(s => s.id === id);
    if (idx !== -1) state.allStudents[idx].photo = dataUrl;
    showToast('تم رفع الصورة ✓', 'success');
    if (typeof renderTodayList === 'function') renderTodayList();
    if (typeof onManualSearch === 'function') onManualSearch();
    if (typeof renderStudentsList === 'function') renderStudentsList();
    if (typeof renderDeaconList === 'function') renderDeaconList();
    if (typeof renderStats === 'function') renderStats();
  } catch {
    showToast('تعذّر رفع الصورة', 'error');
  }
};

// ===== PHOTO HELPERS =====
function compressImage(file, maxSize = 480, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; } }
        else       { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; } }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('img-load-failed'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('read-failed'));
    reader.readAsDataURL(file);
  });
}

window.handlePhotoSelect = async (event, mode) => {
  const file = event.target.files[0];
  event.target.value = ''; // يسمح باختيار نفس الملف تاني لو عايز
  if (!file) return;
  try {
    const dataUrl = await compressImage(file);
    const preview = document.getElementById(mode + '-photo-preview');
    const removeBtn = document.getElementById(mode + '-photo-remove-btn');
    preview.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover">`;
    if (removeBtn) removeBtn.style.display = 'block';
    if (mode === 'new') state.newPhotoData = dataUrl; else state.editPhotoData = dataUrl;
  } catch {
    showToast('تعذّر تحميل الصورة', 'error');
  }
};

window.clearNewPhoto = () => {
  state.newPhotoData = '';
  document.getElementById('new-photo-preview').innerHTML = '👤';
  document.getElementById('new-photo-remove-btn').style.display = 'none';
};

window.clearEditPhoto = () => {
  state.editPhotoData = '';
  document.getElementById('edit-photo-preview').innerHTML = '👤';
  document.getElementById('edit-photo-remove-btn').style.display = 'none';
};

window.openLightbox = (src) => {
  if (!src) return;
  document.getElementById('lightbox-img').src = src;
  document.getElementById('photo-lightbox').style.display = 'flex';
  document.body.style.overflow = 'hidden';
};

window.openLightboxFor = (id) => {
  const s = state.allStudents.find(x => x.id === id);
  if (s && s.photo) openLightbox(s.photo);
};

window.closeLightbox = () => {
  document.getElementById('photo-lightbox').style.display = 'none';
  document.body.style.overflow = '';
};
