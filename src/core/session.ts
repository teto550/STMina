// @ts-nocheck
import { state } from '@/core/state';
import { GRADES, SECTION } from '@/core/section';
import { gradeNamesOfAccess } from '@/core/access-config';

const PHASE_GROUPS = {
  'سنة تالتة ابتدائي': ['سنة تالتة ابتدائي', 'سنة رابعة ابتدائي'],
  'سنة رابعة ابتدائي': ['سنة تالتة ابتدائي', 'سنة رابعة ابتدائي'],
  'سنة خامسة ابتدائي': ['سنة خامسة ابتدائي', 'سنة سادسة ابتدائي'],
  'سنة سادسة ابتدائي': ['سنة خامسة ابتدائي', 'سنة سادسة ابتدائي']
};

export function normalizePhaseGrades(value) {
  const raw = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(/[;,]/) : []);
  const list = raw.flatMap(item => String(item || '').split(/[;,]/)).map(item => item.trim()).filter(Boolean);
  const unique = [];
  list.forEach(item => {
    if (GRADES.includes(item) && !unique.includes(item)) unique.push(item);
  });
  return unique;
}

const GIRLS_PHASE_GROUPS = {
  'سنة أولى ابتدائي':  ['سنة أولى ابتدائي', 'سنة تانية ابتدائي'],
  'سنة تانية ابتدائي': ['سنة أولى ابتدائي', 'سنة تانية ابتدائي'],
  ...PHASE_GROUPS
};

export function getPhaseGradesForGrade(grade) {
  if (!grade) return [];
  const groups = SECTION === 'girls' ? GIRLS_PHASE_GROUPS : PHASE_GROUPS;
  if (groups[grade]) return groups[grade];
  return [grade];
}

export function getUserManagedGrades() {
  if (state.currentUserRole === 'admin') return GRADES.slice();
  // role-based access: the classes of the person's roles in this section
  if (state.accessSource === 'roles' && state.access) return gradeNamesOfAccess(state.access, SECTION).filter(g => GRADES.includes(g));
  const allowed = [];
  if (state.currentUserIsPhaseLead && state.currentUserPhaseGrades.length) {
    state.currentUserPhaseGrades.forEach(g => { if (GRADES.includes(g) && !allowed.includes(g)) allowed.push(g); });
  }
  if (state.currentUserIsLead && state.currentUserGrade && !allowed.includes(state.currentUserGrade)) allowed.push(state.currentUserGrade);
  if (state.currentUserGrade && !allowed.includes(state.currentUserGrade)) allowed.push(state.currentUserGrade);
  return allowed.filter(g => GRADES.includes(g));
}

export function canManageGrade(g) {
  if (!g) return false;
  if (state.currentUserRole === 'admin') return true;
  return getUserManagedGrades().includes(g);
}

// ملحوظة: canManageGrade بترجع true كمان لأي خادم عادي على سنته هو (مش بس المسؤول) —
// ده مقصود لأماكن زي البروفايل. الدالة دي أدق: بترجع true للأدمن أو مسؤول السنة/المرحلة بس (مسؤول فعلي).
export function isGradeManagerOf(g) {
  if (!g) return false;
  if (state.currentUserRole === 'admin') return true;
  return (state.currentUserIsLead && state.currentUserGrade === g) || (state.currentUserIsPhaseLead && state.currentUserPhaseGrades.includes(g));
}

export function formatAssignedGradesLabel(grades) {
  const valid = (grades || []).filter(Boolean).filter(g => GRADES.includes(g));
  if (!valid.length) return '';
  const unique = [...new Set(valid)];
  return unique.join(' / ');
}
