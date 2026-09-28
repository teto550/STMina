// @ts-nocheck
import { updateDoc, doc } from 'firebase/firestore';
import { state } from '@/core/state';
import { nameMatchesSearch } from '@/features/import-export/import-attendance';
import { db } from '@/core/firebase';
import { logActivity } from '@/core/presence';

// ===== STARS =====
window.openStarModal = () => {
  document.getElementById('star-search').value = '';
  renderStarResults();
  document.getElementById('star-modal').style.display = 'block';
  document.body.style.overflow = 'hidden';
};

window.closeStarModal = () => {
  document.getElementById('star-modal').style.display = 'none';
  document.body.style.overflow = '';
};

window.renderStarResults = () => {
  const q    = document.getElementById('star-search').value.trim();
  const cont = document.getElementById('star-results');
  if (!q) { cont.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:12px;font-size:13px">اكتب اسم المخدوم عشان يظهر هنا</div>'; return; }
  const matches = state.allStudents.filter(s => nameMatchesSearch(s.name, q)).slice(0, 20);
  if (!matches.length) { cont.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:12px;font-size:13px">لا يوجد نتائج</div>'; return; }
  cont.innerHTML = matches.map(s => {
    const count = s.starCount || 0;
    const full  = count >= 6;
    return `<div style="display:flex;align-items:center;gap:10px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.name}</div>
        <div style="font-size:12px;color:var(--text-dim);margin-top:2px">⭐ ${count} / 6</div>
      </div>
      <button class="action-btn green" style="flex:none;padding:8px 14px;${full ? 'opacity:.5;cursor:not-allowed' : ''}" ${full ? 'disabled' : ''} onclick="addStar('${s.id}')">➕ نجمة</button>
    </div>`;
  }).join('');
};

window.addStar = async (id) => {
  const s = state.allStudents.find(x => x.id === id);
  if (!s) return;
  const current = s.starCount || 0;
  if (current >= 6) { showToast('وصل للحد الأقصى (6 نجوم)', 'error'); return; }
  const next = current + 1;
  try {
    await updateDoc(doc(db, 'students', id), { starCount: next });
    s.starCount = next;
    showToast(`⭐ اتضافت نجمة لـ ${s.name} (${next}/6)`, 'success');
    logActivity('أضاف نجمة', `${s.name} (${next}/6)`);
    renderStarResults();
  } catch (e) {
    console.error(e);
    showToast('حصل خطأ أثناء إضافة النجمة', 'error');
  }
};

// إضافة أو إزالة نجمة من ملف المخدوم مباشرة (بيستخدمها البروفايل)
window.changeStar = async (id, delta) => {
  const s = state.allStudents.find(x => x.id === id);
  if (!s) return;
  const next = Math.max(0, Math.min(6, (s.starCount || 0) + delta));
  if (next === (s.starCount || 0)) return;
  try {
    await updateDoc(doc(db, 'students', id), { starCount: next });
    s.starCount = next;
    logActivity(delta > 0 ? 'أضاف نجمة' : 'شال نجمة', `${s.name} (${next}/6)`);
    openProfile(id);
  } catch (e) {
    console.error(e);
    showToast('حصل خطأ أثناء تعديل النجوم', 'error');
  }
};
