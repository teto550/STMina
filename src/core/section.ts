// @ts-nocheck
import { state } from '@/core/state';

// ===== حساب بنين / حساب بنات =====
// الجهاز ده شغّال دلوقتي على أي قسم؟ اتخزنت محليًا على الجهاز، ومفيش قسم = "بنين" (الوضع الافتراضي/القديم)
// A link such as https://.../?section=girls opens the girls section directly (handy to send to the girls' servants).
try { const q = new URLSearchParams(location.search).get('section'); if (q === 'girls' || q === 'boys') localStorage.setItem('appSection', q); } catch (e) {}

export let SECTION = (() => { try { return localStorage.getItem('appSection') === 'girls' ? 'girls' : 'boys'; } catch(e) { return 'boys'; } })();

const isGirlsSection = () => SECTION === 'girls';

// بيتحط في أي مستند جديد (مخدوم/خادم) عشان يتفلتر بعدين حسب القسم
export const sectionTag = () => SECTION;

// مستندات قديمة معندهاش section خالص = تتعامل معاها كإنها "بنين" (توافقًا مع البيانات القديمة)
export const inCurrentSection = (docData) => (docData.section || 'boys') === SECTION;

// السنين الدراسية لكل قسم: بنين = تالتة → سادسة | بنات = أولى → سادسة
const BOYS_GRADES  = ['سنة تالتة ابتدائي', 'سنة رابعة ابتدائي', 'سنة خامسة ابتدائي', 'سنة سادسة ابتدائي'];

const GIRLS_GRADES = ['سنة أولى ابتدائي', 'سنة تانية ابتدائي', ...BOYS_GRADES];

export const ALL_GRADES   = SECTION === 'girls' ? GIRLS_GRADES : BOYS_GRADES;

export let GRADES = ALL_GRADES.slice();

// قايمة السنين في فورم تسجيل الخادم (بتظهر قبل الدخول) حسب القسم
(function fillRegGradeSelect() {
  const sel = document.getElementById('reg-grade');
  if (!sel) return;
  sel.innerHTML = '<option value="">اختر السنة الدراسية</option>' +
    GRADES.map(g => `<option value="${g}">${g}</option>`).join('');
})();

// تحويل كلمة "خدام/خادم" لصيغة مؤنثة "خادمات/خادمة" في كل نص ظاهر للمستخدم لو القسم النشط بنات
const GENDER_SWAP_MAP = {
  'للخدام': 'للخادمات', 'للخادم': 'للخادمة',
  'الخدام': 'الخادمات', 'الخادم': 'الخادمة',
  'خدام':   'خادمات',   'خادم':   'خادمة'
};

const GENDER_SWAP_RE = /(?<![\u0621-\u064A])(للخدام|للخادم|الخدام|الخادم|خدام|خادم)(?![\u0621-\u064A])/g;

export function genderizeText(str) {
  if (SECTION !== 'girls' || typeof str !== 'string' || str.indexOf('خد') === -1) return str;
  return str.replace(GENDER_SWAP_RE, m => GENDER_SWAP_MAP[m] || m);
}

function genderizeNode(root) {
  if (SECTION !== 'girls' || !root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let node;
  while ((node = walker.nextNode())) {
    const nv = genderizeText(node.nodeValue);
    if (nv !== node.nodeValue) node.nodeValue = nv;
  }
}

let __genderObserverStarted = false;

export function setupGenderObserver() {
  if (__genderObserverStarted) { genderizeNode(document.getElementById('app-screen')); return; }
  __genderObserverStarted = true;
  const root = document.getElementById('app-screen');
  if (!root) return;
  const mo = new MutationObserver((mutations) => {
    if (SECTION !== 'girls') return;
    for (const m of mutations) {
      if (m.type === 'characterData') {
        const t = m.target;
        const nv = genderizeText(t.nodeValue);
        if (nv !== t.nodeValue) t.nodeValue = nv;
      } else if (m.type === 'childList') {
        m.addedNodes.forEach(n => {
          if (n.nodeType === Node.TEXT_NODE) {
            const nv = genderizeText(n.nodeValue);
            if (nv !== n.nodeValue) n.nodeValue = nv;
          } else if (n.nodeType === Node.ELEMENT_NODE) {
            genderizeNode(n);
          }
        });
      }
    }
  });
  mo.observe(root, { childList: true, subtree: true, characterData: true });
  genderizeNode(root);
  // Placeholders الثابتة اللي مش بتتبني كل مرة (مش بيتغطوا بالـ observer)
  ['sd-att-search', 'servants-directory-search', 'new-deacon-name'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.placeholder) el.placeholder = genderizeText(el.placeholder);
  });
}

// The ONLY two values ever stored in a servant's `gender` field (users and deacons documents).
export const GENDERS = ['male', 'female'];
export const genderOfSection = (section) => (section === 'girls' ? 'female' : 'male');
export const sectionOfGender = (gender) => (gender === 'female' ? 'girls' : 'boys');

// Which section an ACCOUNT belongs to: its gender decides (female -> girls, male -> boys). Accounts created before the
// gender field existed fall back to the older `section` field, and a missing value means boys, like the old data.
export const accountSection = (data) => {
  if (data && GENDERS.includes(data.gender)) return sectionOfGender(data.gender);
  return (data && data.section === 'girls') ? 'girls' : 'boys';
};

// What to do with a logged-in account given the section this device is on:
//   'ok'        -> admin, or the account belongs to this device's section
//   'redirect'  -> switch the device to the account's own section and reload (first time)
//   'deny'      -> we already tried that once and it did not stick: do not let her in
export function checkAccountSection(role, data, redirectedTo) {
  if (role === 'admin') return { action: 'ok' };
  const mine = accountSection(data);
  if (mine === SECTION) return { action: 'ok' };
  return redirectedTo === mine ? { action: 'deny', target: mine } : { action: 'redirect', target: mine };
}

// Point this device at a section; false if the browser refuses to store it (private mode).
export function switchDeviceToSection(target) {
  try { localStorage.setItem('appSection', target); return localStorage.getItem('appSection') === target; } catch (e) { return false; }
}

// Only admins move between the two sections. Every other account belongs to exactly one (see the check at login in auth.ts).
window.toggleAppSection = () => {
  if (state.currentUserRole !== 'admin') { showToast('حسابك على قسم واحد بس', 'info'); return; }
  const goingTo = SECTION === 'girls' ? 'boys' : 'girls';
  try { localStorage.setItem('appSection', goingTo); } catch(e) {}
  location.reload();
};

// ترتيب السنين الدراسية (ابتدائي) عشان زرار "ترقية السنة" يعرف السنة الجاية إيه
export const GRADE_SEQUENCE = [
  'سنة أولى ابتدائي', 'سنة تانية ابتدائي', 'سنة تالتة ابتدائي',
  'سنة رابعة ابتدائي', 'سنة خامسة ابتدائي', 'سنة سادسة ابتدائي'
];

// Always-visible "which account am I on" badge in the top bar (the coloured strip is pure CSS).
const sectionBadge = document.getElementById('section-badge');
if (sectionBadge) sectionBadge.textContent = SECTION === 'girls' ? '🌸 حساب البنات' : '👦 حساب البنين';

// The girls look only applies inside the app (after login). Login / pending / complete-profile screens
// always use the default blue. `appSessionHint` lets the inline <head> script apply the right theme
// before first paint on a reload, so a girls session doesn't flash blue.
const THEME_COLOR = { boys: '#1a1f2e', girls: '#221e38' }; // browser bar: dark blue / dark violet
export function applySectionTheme(inApp) {
  const girls = inApp && SECTION === 'girls';
  document.documentElement.classList.toggle('girls', girls);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', girls ? THEME_COLOR.girls : THEME_COLOR.boys);
  document.title = girls ? 'خدمة ابتدائي 🌸 بنات' : 'خدمة ابتدائي';
  try { if (inApp) localStorage.setItem('appSessionHint', '1'); else localStorage.removeItem('appSessionHint'); } catch (e) {}
}

// registration form: the new servant's gender (male = boys' section, female = girls' section). Changing it reloads the page,
// because the classes and the servants list shown in the form depend on the section.
const regGender = document.getElementById('reg-gender');
if (regGender) regGender.value = genderOfSection(SECTION);
window.changeRegGender = (value) => {
  if (!switchDeviceToSection(sectionOfGender(value))) return;
  try { sessionStorage.setItem('openRegisterTab', '1'); } catch (e) {}
  location.reload();
};
