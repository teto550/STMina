// @ts-nocheck

// ===== حساب بنين / حساب بنات =====
// الجهاز ده شغّال دلوقتي على أي قسم؟ اتخزنت محليًا على الجهاز، ومفيش قسم = "بنين" (الوضع الافتراضي/القديم)
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

window.toggleAppSection = () => {
  const goingTo = SECTION === 'girls' ? 'boys' : 'girls';
  if (!confirm(goingTo === 'girls' ? 'هتتنقل لحساب البنات (الفصول هتبقى فاضية). متأكد؟' : 'هتتنقل لحساب البنين. متأكد؟')) return;
  try { localStorage.setItem('appSection', goingTo); } catch(e) {}
  location.reload();
};

// ترتيب السنين الدراسية (ابتدائي) عشان زرار "ترقية السنة" يعرف السنة الجاية إيه
export const GRADE_SEQUENCE = [
  'سنة أولى ابتدائي', 'سنة تانية ابتدائي', 'سنة تالتة ابتدائي',
  'سنة رابعة ابتدائي', 'سنة خامسة ابتدائي', 'سنة سادسة ابتدائي'
];
