// @ts-nocheck
import { doc, updateDoc, query, collection, where } from 'firebase/firestore';
import { state } from '@/core/state';
import { credsEsc } from '@/features/import-export/import-creds';
import { getDocFast, getDocsTtl } from '@/core/firestore-helpers';
import { inCurrentSection } from '@/core/section';
import { db } from '@/core/firebase';
import { logActivity } from '@/core/presence';

// ===== STUDENT PROFILE =====
window.openProfile = (id) => {
  const s = state.allStudents.find(x => x.id === id);
  if (!s) return;

  // Header
  document.getElementById('prof-edit-id').value = id;
  const profAvatar = document.getElementById('prof-avatar');
  if (s.photo) {
    profAvatar.innerHTML = `<img src="${s.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:16px;cursor:zoom-in" onclick="openLightbox('${s.photo}')">`;
  } else {
    profAvatar.innerHTML = '';
    profAvatar.textContent = s.name.trim()[0] || '؟';
  }
  document.getElementById('prof-name').textContent   = s.name;
  document.getElementById('prof-grade').textContent  = s.grade || '';

  // Stars
  const starCount = s.starCount || 0;
  document.getElementById('prof-stars').innerHTML = Array.from({ length: 6 }, (_, i) => i < starCount ? '⭐' : '☆').join('');
  document.getElementById('prof-stars-actions').innerHTML = state.currentUserRole ? `
    <button onclick="changeStar('${id}',-1)" style="background:rgba(231,76,60,0.12);border:1px solid rgba(231,76,60,0.3);border-radius:8px;color:var(--danger);font-size:16px;font-weight:700;width:32px;height:32px;cursor:pointer">−</button>
    <button onclick="changeStar('${id}',1)" style="background:rgba(46,204,113,0.12);border:1px solid rgba(46,204,113,0.3);border-radius:8px;color:var(--success);font-size:16px;font-weight:700;width:32px;height:32px;cursor:pointer">+</button>
  ` : '';

  // Attendance of THIS student only: one small query, instead of loading the whole attendance history for a profile.
  document.getElementById('prof-count').textContent = s.attendanceCount || 0;
  document.getElementById('prof-last').textContent = '…';
  const datesCont = document.getElementById('prof-attend-dates');
  datesCont.innerHTML = '<div style="color:var(--text-dim);font-size:13px">جاري التحميل…</div>';
  const profToken = window.__profToken = (window.__profToken || 0) + 1;
  getDocsTtl(query(collection(db, 'attendance'), where('studentId', '==', id)), 'attendance-student:' + id)
    .then(snap => snap.docs.map(d => d.data()).filter(inCurrentSection).map(d => d.date).sort().reverse()) // الأحدث أولاً
    .catch(() => [])
    .then(attendDates => {
      if (profToken !== window.__profToken) return; // another profile was opened meanwhile
      const lastDate = attendDates[0] || null;
      document.getElementById('prof-count').textContent = Math.max(s.attendanceCount || 0, attendDates.length);
      if (lastDate) {
        const p = lastDate.split('-');
        document.getElementById('prof-last').textContent = `${p[2]}/${p[1]}/${p[0]}`;
      } else if (s.attendanceCount) {
        // حضر قبل كده بس التواريخ التفصيلية اتشالت (بعد ترقية سنة) — العدد لسه محفوظ في ملفه
        document.getElementById('prof-last').textContent = 'قبل الترقية الأخيرة';
      } else {
        document.getElementById('prof-last').textContent = 'لم يحضر بعد';
      }
      if (attendDates.length) {
        datesCont.innerHTML = attendDates.map(d => {
          const dd = new Date(d + 'T00:00:00');
          const label = dd.toLocaleDateString('ar-EG', { day:'numeric', month:'short', year:'numeric' });
          return `<span style="background:rgba(46,204,113,0.12);border:1px solid rgba(46,204,113,0.3);color:var(--success);border-radius:8px;padding:5px 10px;font-size:12px;font-weight:700;white-space:nowrap">✅ ${label}</span>`;
        }).join('');
      } else if (s.attendanceCount) {
        datesCont.innerHTML = `<div style="color:var(--text-dim);font-size:13px">✅ حضر ${s.attendanceCount} مرة قبل كده — التواريخ التفصيلية اتشالت بعد آخر ترقية سنة، بس العدد محفوظ</div>`;
      } else {
        datesCont.innerHTML = '<div style="color:var(--text-dim);font-size:13px">لم يحضر بعد</div>';
      }
    });

  // Details rows
  const phones = [
    { icon:'📞', key:'تليفون الأب',    val: s.phoneDad || '' },
    { icon:'📞', key:'تليفون الأم',    val: s.phoneMom || '' },
    { icon:'📱', key:'تليفون المخدوم', val: s.phoneStudent || '' },
  ];
  // ===== العنوان + موقع GPS =====
  const hasGeo  = s.geoLat != null && s.geoLng != null;
  const mapsUrl = hasGeo ? `https://www.google.com/maps/dir/?api=1&destination=${s.geoLat},${s.geoLng}` : '';
  const addrTxt = String(s.address || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let geoRowHtml = '';
  if (addrTxt || hasGeo || state.currentUserRole) {
    const geoMeta = hasGeo
      ? ['موقع GPS محفوظ',
         s.geoAt  ? new Date(s.geoAt).toLocaleDateString('ar-EG', { day:'numeric', month:'short', year:'numeric' }) : '',
         s.geoAcc ? `دقة ~${s.geoAcc} م` : ''].filter(Boolean).join(' · ')
      : '';
    geoRowHtml = `<div class="prof-row" style="flex-wrap:wrap">
      <div class="prof-icon">📍</div>
      <div style="flex:1;min-width:0">
        <div class="prof-key">العنوان</div>
        ${hasGeo
          ? `<a href="${mapsUrl}" target="_blank" rel="noopener" class="prof-val" style="display:block;color:var(--accent);text-decoration:underline;text-underline-offset:3px">${addrTxt || 'افتح الموقع على الخريطة'}</a>
             <div style="font-size:11px;color:var(--text-dim);margin-top:3px">${geoMeta}</div>`
          : (addrTxt ? `<div class="prof-val">${addrTxt}</div>` : `<div class="prof-val" style="color:var(--text-dim);font-weight:400">لسه مفيش عنوان</div>`)}
      </div>
      ${hasGeo ? `<a href="${mapsUrl}" target="_blank" rel="noopener" style="background:rgba(var(--accent-rgb),0.12);border:1px solid rgba(var(--accent-rgb),0.3);border-radius:10px;color:var(--accent);padding:8px 14px;font-size:13px;font-weight:700;text-decoration:none">🧭 وصّلني</a>` : ''}
      ${state.currentUserRole ? `<div style="width:100%;display:flex;gap:8px;margin-top:8px">
        <button id="prof-geo-btn" class="action-btn green" style="flex:1;padding:10px;font-size:13px" onclick="captureStudentLocation('${id}')">${hasGeo ? '🔄 تحديث الموقع' : '📍 تحديد العنوان بالـ GPS'}</button>
        ${hasGeo ? `<button class="action-btn red" style="padding:10px 14px;font-size:13px" onclick="clearStudentLocation('${id}')">🗑</button>` : ''}
      </div>` : ''}
    </div>`;
  }
  // ===== ID (لكل الخدام) + الباسورد (أدمن/مسؤول المرحلة بس) =====
  const idRowHtml = s.kidId ? `<div class="prof-row"><div class="prof-icon">🆔</div><div style="flex:1;min-width:0"><div class="prof-key">ID</div><div class="prof-val" dir="ltr" style="text-align:right;user-select:all">${credsEsc(s.kidId)}</div></div></div>` : '';
  const showPw = !!s.kidId && canSeeStudentPassword(s);
  const pwRowHtml = showPw ? `<div class="prof-row"><div class="prof-icon">🔑</div><div style="flex:1;min-width:0"><div class="prof-key">الباسورد <span style="font-size:10px;color:var(--warning)">(للأدمن ومسؤول المرحلة بس)</span></div><div id="prof-pw-val" class="prof-val" style="color:var(--text-dim);font-weight:400">…</div></div><div id="prof-pw-actions" style="display:flex;gap:6px"></div></div>` : '';
  const fields = [
    { icon:'🆔', key:'ID', val:'', html: idRowHtml, phone:false },
    { icon:'🔑', key:'الباسورد', val:'', html: pwRowHtml, phone:false },
    { icon:'🎂', key:'تاريخ الميلاد', val: s.dob ? new Date(s.dob).toLocaleDateString('ar-EG') : '', phone: false },
    { icon:'📍', key:'العنوان', val: '', html: geoRowHtml, phone: false },
    ...phones.map(p => ({ ...p, phone: true })),
    { icon:'✝️', key:'أب الاعتراف',   val: s.confessor || '',   phone: false },
    { icon:'🙏', key:'خادم الافتقاد', val: s.deacon || '',      phone: false },
    { icon:'📞', key:'آخر افتقاد تليفوني', val: s.lastVisitPhone ? (() => { const d=new Date(s.lastVisitPhone); const m=(new Date().getFullYear()-d.getFullYear())*12+(new Date().getMonth()-d.getMonth()); return d.toLocaleDateString('ar-EG',{day:'numeric',month:'long',year:'numeric'}) + (m===0?' (هذا الشهر)':' · منذ '+m+' شهر'); })() : '', phone: false },
    { icon:'🏠', key:'آخر افتقاد منزلي',   val: s.lastVisitHome  ? (() => { const d=new Date(s.lastVisitHome);  const m=(new Date().getFullYear()-d.getFullYear())*12+(new Date().getMonth()-d.getMonth()); return d.toLocaleDateString('ar-EG',{day:'numeric',month:'long',year:'numeric'}) + (m===0?' (هذا الشهر)':' · منذ '+m+' شهر'); })() : '', phone: false },
    { icon:'📝', key:'ملاحظات',          val: s.notes || '',         phone: false },
  ];

  document.getElementById('prof-details').innerHTML = fields
    .filter(f => f.val || f.html)
    .map(f => f.html ? f.html : `<div class="prof-row">
      <div class="prof-icon">${f.icon}</div>
      <div style="flex:1">
        <div class="prof-key">${f.key}</div>
        ${f.phone
          ? `<a href="tel:${f.val}" class="prof-val phone-link">${f.val}</a>`
          : `<div class="prof-val">${f.val}</div>`
        }
      </div>
      ${f.phone ? `<a href="tel:${f.val}" style="background:rgba(46,204,113,0.12);border:1px solid rgba(46,204,113,0.3);border-radius:10px;color:var(--success);padding:8px 14px;font-size:13px;font-weight:700;text-decoration:none">📲 اتصل</a>` : ''}
    </div>`)
    .join('') || '<div style="color:var(--text-dim);text-align:center;padding:20px">لا توجد بيانات إضافية</div>';

  document.getElementById('profile-modal').style.display = 'block';
  document.body.style.overflow = 'hidden';
  if (showPw) loadStudentPassword(id);
};

window.closeProfile = () => {
  document.getElementById('profile-modal').style.display = 'none';
  document.body.style.overflow = '';
};

// ===== باسورد المخدوم (أدمن فقط) =====
function canSeeStudentPassword(s) {
  return state.currentUserRole === 'admin';
}

async function loadStudentPassword(id) {
  const valEl = () => document.getElementById('prof-pw-val');
  const stale = () => document.getElementById('prof-edit-id').value !== id || !valEl();
  try {
    const snap = await getDocFast(doc(db, 'student_secrets', id), 6000);
    if (stale()) return;
    if (!snap) { valEl().textContent = 'غير متاح دلوقتي'; return; }
    const pw = snap.exists() ? (snap.data().password || '') : '';
    if (!pw) { valEl().textContent = 'غير مسجل'; return; }
    const MASK = '••••••••';
    let shown = false;
    const v = valEl();
    v.textContent = MASK; v.setAttribute('dir', 'ltr');
    v.style.cssText = 'text-align:right;unicode-bidi:plaintext;user-select:all;word-break:break-all;letter-spacing:1px';
    const mk = (txt, cls) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = txt; return b; };
    const tog = mk('👁 إظهار', 'action-btn'), cp = mk('📋 نسخ', 'action-btn green');
    tog.onclick = () => { shown = !shown; v.textContent = shown ? pw : MASK; tog.textContent = shown ? '🙈 إخفاء' : '👁 إظهار'; };
    cp.onclick = async () => { try { await navigator.clipboard.writeText(pw); showToast('اتنسخ الباسورد', 'success'); } catch (e) { showToast('معرفتش أنسخ', 'error'); } };
    document.getElementById('prof-pw-actions').replaceChildren(tog, cp);
  } catch (e) {
    console.error(e);
    if (!stale()) valEl().textContent = 'غير متاح';
  }
}

// ===== STUDENT GPS LOCATION =====
let geoCapturing = false;

async function saveStudentGeo(id, data, okMsg, logAction) {
  const s = state.allStudents.find(x => x.id === id);
  try {
    const p = updateDoc(doc(db, 'students', id), data);
    // أوفلاين: الكتابة بتتخزن على الجهاز وتترفع لوحدها، فمنستناش الرد
    if (navigator.onLine) await p; else p.catch(console.error);
    if (s) Object.assign(s, data);
    logActivity(logAction, s ? s.name : '');
    showToast(navigator.onLine ? okMsg : 'اتحفظ وهيترفع لما النت يرجع', 'success');
    const pm = document.getElementById('profile-modal');
    if (pm.style.display === 'block' && document.getElementById('prof-edit-id').value === id) openProfile(id);
  } catch (e) {
    console.error(e);
    showToast('حصل خطأ أثناء الحفظ', 'error');
  }
}

window.captureStudentLocation = (id) => {
  const s = state.allStudents.find(x => x.id === id);
  if (!s || geoCapturing) return;
  if (!navigator.geolocation) { showToast('المتصفح ده مش بيدعم تحديد الموقع', 'error'); return; }
  if (s.geoLat != null && !confirm('فيه موقع محفوظ قبل كده. تستبدله بموقعك الحالي؟')) return;

  geoCapturing = true;
  const btn = document.getElementById('prof-geo-btn');
  const idleText = btn ? btn.textContent : '';
  const setBtn = (txt, busy) => { if (btn) { btn.textContent = txt; btn.disabled = busy; btn.style.opacity = busy ? '0.7' : '1'; } };
  setBtn('⏳ بحدد موقعك…', true);

  let best = null, finished = false, watchId = null, timer = null;
  const stop = () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); clearTimeout(timer); };
  const abort = (msg) => { finished = true; stop(); geoCapturing = false; setBtn(idleText, false); showToast(msg, 'error'); };

  const finish = async () => {
    if (finished) return;
    if (!best) { abort('معرفتش أحدد الموقع، جرب تاني'); return; }
    finished = true; stop();
    const acc = Math.round(best.coords.accuracy);
    if (acc > 100 && !confirm(`دقة الموقع ضعيفة (~${acc} متر).\nلو تقدر اقف في مكان مفتوح وجرب تاني.\nتحفظه برضو؟`)) {
      geoCapturing = false; setBtn(idleText, false); return;
    }
    await saveStudentGeo(id, {
      geoLat: +best.coords.latitude.toFixed(6),
      geoLng: +best.coords.longitude.toFixed(6),
      geoAcc: acc,
      geoAt:  Date.now(),
    }, '📍 اتحفظ موقع المخدوم', 'حدد موقع GPS');
    geoCapturing = false;
    setBtn(idleText, false);
  };

  // بنتابع القراءات كام ثانية ونختار الأدق (أول قراءة غالباً بتبقى تقريبية)
  watchId = navigator.geolocation.watchPosition(
    pos => {
      if (finished) return;
      if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
      setBtn(`⏳ دقة الموقع ~${Math.round(best.coords.accuracy)} م…`, true);
      if (best.coords.accuracy <= 20) finish();
    },
    err => {
      if (finished) return;
      if (best) { finish(); return; }
      abort(err.code === 1 ? 'اسمح للمتصفح بالوصول للموقع'
          : err.code === 3 ? 'شغّل الـ GPS وجرب تاني'
          : 'الموقع مش متاح دلوقتي');
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
  );
  timer = setTimeout(finish, 12000);
};

window.clearStudentLocation = async (id) => {
  if (!confirm('تمسح موقع الـ GPS المحفوظ للمخدوم ده؟')) return;
  await saveStudentGeo(id, { geoLat: null, geoLng: null, geoAcc: null, geoAt: null }, 'اتمسح الموقع', 'مسح موقع GPS');
};
