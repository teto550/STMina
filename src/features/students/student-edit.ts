// @ts-nocheck
import { state } from '@/core/state';
import { sectionTag } from '@/core/section';
import { deaconIdOfName, deaconNameOf } from '@/core/servants-index';
import { db } from '@/core/firebase';

// ===== EDIT STUDENT =====
window.openEdit = (id) => {
  const s = state.allStudents.find(x => x.id === id);
  if (!s) return;
  document.getElementById('edit-id').value             = id;
  state.editPhotoData = s.photo || '';
  const editPreview = document.getElementById('edit-photo-preview');
  const editRemoveBtn = document.getElementById('edit-photo-remove-btn');
  if (s.photo) {
    editPreview.innerHTML = `<img src="${s.photo}" style="width:100%;height:100%;object-fit:cover">`;
    editRemoveBtn.style.display = 'block';
  } else {
    editPreview.innerHTML = '👤';
    editRemoveBtn.style.display = 'none';
  }
  document.getElementById('edit-name').value           = s.name || '';
  document.getElementById('edit-grade').value          = s.grade || 'سنة تالتة ابتدائي';
  document.getElementById('edit-dob').value            = s.dob || '';
  document.getElementById('edit-address').value        = s.address || '';
  document.getElementById('edit-phone-dad').value      = s.phoneDad || '';
  document.getElementById('edit-phone-mom').value      = s.phoneMom || '';
  document.getElementById('edit-phone-student').value  = s.phoneStudent || '';
  document.getElementById('edit-confessor').value      = s.confessor || '';
  document.getElementById('edit-deacon').value         = deaconNameOf(s) || '';
  document.getElementById('edit-last-visit-phone').value = s.lastVisitPhone || '';
  document.getElementById('edit-last-visit-home').value  = s.lastVisitHome  || '';
  document.getElementById('edit-notes').value          = s.notes || '';
  document.getElementById('edit-att-count').value      = s.attendanceCount ?? '';
  document.getElementById('edit-modal').style.display  = 'block';
  document.body.style.overflow = 'hidden';
};

window.closeEdit = () => {
  document.getElementById('edit-modal').style.display = 'none';
  document.body.style.overflow = '';
};

window.saveEdit = async () => {
  const id   = document.getElementById('edit-id').value;
  const name = document.getElementById('edit-name').value.trim();
  if (!name) { showToast('اكتب اسم المخدوم', 'error'); return; }

  const { doc, updateDoc } = await import("firebase/firestore");
  const updates = {
    name,
    grade:         document.getElementById('edit-grade').value,
    dob:           document.getElementById('edit-dob').value || '',
    address:       document.getElementById('edit-address').value.trim() || '',
    phoneDad:      document.getElementById('edit-phone-dad').value.trim() || '',
    phoneMom:      document.getElementById('edit-phone-mom').value.trim() || '',
    phoneStudent:  document.getElementById('edit-phone-student').value.trim() || '',
    confessor:     document.getElementById('edit-confessor').value.trim() || '',
    deacon:        document.getElementById('edit-deacon').value || '',
    deaconId:      deaconIdOfName(document.getElementById('edit-deacon').value, sectionTag()), // link by id (name kept for compatibility)
    lastVisitPhone: document.getElementById('edit-last-visit-phone').value || '',
    lastVisitHome:  document.getElementById('edit-last-visit-home').value  || '',
    notes:          document.getElementById('edit-notes').value.trim() || '',
    attendanceCount: parseInt(document.getElementById('edit-att-count').value) || 0,
    photo:          state.editPhotoData || '',
  };

  await updateDoc(doc(db, 'students', id), updates);

  // Update local cache
  const idx = state.allStudents.findIndex(s => s.id === id);
  if (idx !== -1) state.allStudents[idx] = { ...state.allStudents[idx], ...updates };

  closeEdit();
  closeProfile();
  renderStudentsList();
  renderDeaconList();
  if (state.currentUserRole === 'admin' && typeof buildDeaconChips === 'function') buildDeaconChips();
  updateDeaconsTabLabel();
  showToast('تم الحفظ ✓', 'success');
};
