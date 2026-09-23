// @ts-nocheck
// Shared mutable state (was module-level `let` variables in the single-file script).
export const state = {
  LEGACY_MIGRATED: false, // هل اتعمل ترحيل البيانات القديمة (قبل نظام السنين المتعددة) ولا لسه
  currentUserRole: null, // 'admin' | 'deacon'
  pendingDeaconsCount: 0, // عدد طلبات تسجيل الخدام المعلّقة للسنة الدراسية الحالية (شارة تاب الخدام)
  currentUserName: '',
  currentUserEmail: '',
  currentUserGrade: null, // السنة الدراسية اللي الخادم مسجل يخدم فيها
  currentUserPhaseGrades: [], // الفصول اللي مسؤول المرحلة بيفتحها (مثال: تالتة/رابعة)
  currentUserIsLead: false, // هل هو "مسؤول" السنة دي
  currentUserIsPhaseLead: false, // هل هو "مسؤول" مرحلة (فصلين/أكثر)
  activeGrade: null, // السنة الدراسية المعروضة/بيتم التعامل معاها دلوقتي
  servantsDirectoryOpen: false, // هل خانة "🙏 الخدام" (جنب الفصول) مفتوحة دلوقتي بدل تابات الفصل العادية
  lastActiveMainTab: 'attendance', // آخر تاب رئيسي كان مفتوح قبل ما ندخل خانة الخدام
  allStudents: [],
  todayAttendance: {},
  allAttendance: {}, // { date: { studentId: true } }
  todayAttendanceUnsub: null, // realtime listener لحضور النهارده — بيخلي أي خادم تاني يشوف الحضور لحظياً
  currentAttGrade: 'الكل',
  currentStuGrade: 'الكل',
  selectedDates: [],
  newPhotoData: '', // base64 data-url للصورة أثناء إضافة مخدوم جديد
  editPhotoData: '', // base64 data-url للصورة أثناء تعديل مخدوم
  quickPhotoTargetId: '', // آي دي المخدوم اللي بنرفعله صورة بسرعة من قوائم الحضور
  ALL_DEACONS_RAW: [], // [{ id, name, grade }] — كل الخدام في كل السنين (مصدر واحد للحقيقة)
  currentDeacon: null,
  currentDeaconFilter: 'all', // 'all' | 'attendance' | 'absence' | 'birthday'
  partNotifUnsub: null,
};
