// evaluateAccount() is the whole "may this person use the app" decision, so every branch is covered here.
vi.mock('@/core/firebase', () => ({ db: {} }));
vi.mock('@/core/section', () => ({ SECTION: 'boys', switchDeviceToSection: vi.fn(() => true) }));
vi.mock('@/api/email', () => ({ sendUnauthorizedAlert: vi.fn(async () => undefined) }));
vi.mock('@/core/firestore-helpers', () => ({ getDocFast: vi.fn(), loadProfileCache: vi.fn() }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn() }));
vi.mock('@/core/session', () => ({
  normalizePhaseGrades: (v: unknown) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(',').filter(Boolean) : []),
  getPhaseGradesForGrade: (g: string) => [g],
}));

import type { User } from 'firebase/auth';
import { evaluateAccount, isProfileIncomplete, loadAccountDecision, type EvaluateInput } from '@/api/account';
import { sendUnauthorizedAlert } from '@/api/email';
import { getDocFast, loadProfileCache } from '@/core/firestore-helpers';
import { switchDeviceToSection } from '@/core/section';
import type { UserDoc } from '@/types/account';

const complete: UserDoc = { name: 'مينا', email: 'm@x.com', role: 'deacon', status: 'approved', gender: 'male', grade: 'سنة رابعة ابتدائي', phones: ['010'], address: 'القاهرة', dob: '2000-01-01', graduated: true };
const run = (over: Partial<EvaluateInput> & { profile?: UserDoc | null }) =>
  evaluateAccount({ user: { uid: 'u1', email: 'm@x.com' }, profile: complete, deviceSection: 'boys', redirectedTo: null, online: true, ...over });

describe('isProfileIncomplete', () => {
  it('a complete profile is complete', () => expect(isProfileIncomplete(complete)).toBe(false));
  it('no profile, no phone, no address or no birth date is incomplete', () => {
    expect(isProfileIncomplete(null)).toBe(true);
    expect(isProfileIncomplete({ ...complete, phones: [], phone: '' })).toBe(true);
    expect(isProfileIncomplete({ ...complete, address: '' })).toBe(true);
    expect(isProfileIncomplete({ ...complete, dob: '' })).toBe(true);
  });
  it('the study status must be known, and a student needs college and university', () => {
    expect(isProfileIncomplete({ ...complete, graduated: undefined })).toBe(true);
    expect(isProfileIncomplete({ ...complete, graduated: false })).toBe(true);
    expect(isProfileIncomplete({ ...complete, graduated: false, college: 'هندسة', university: 'القاهرة' })).toBe(false);
  });
  it('the old single `phone` field still counts', () => expect(isProfileIncomplete({ ...complete, phones: undefined, phone: '010' })).toBe(false));
});

describe('not allowed in', () => {
  it('a pending account waits for the admin', () => expect(run({ profile: { ...complete, status: 'pending' } })).toEqual({ kind: 'blocked', reason: 'pending' }));
  it('a rejected account is refused', () => expect(run({ profile: { ...complete, status: 'rejected' } })).toEqual({ kind: 'blocked', reason: 'rejected' }));
  it('an account with no record is never let in by default (online and offline)', () => {
    expect(run({ profile: null })).toEqual({ kind: 'blocked', reason: 'unregistered' });
    expect(run({ profile: null, online: false })).toEqual({ kind: 'blocked', reason: 'unverifiable' });
  });
});

describe('admins (from their role)', () => {
  it('an account with role admin enters without a class, and skips the pending check', () => {
    const d = run({ profile: { ...complete, role: 'admin', status: 'pending', grade: null } });
    expect(d.kind).toBe('enter');
    if (d.kind === 'enter') {
      expect(d.session).toMatchObject({ currentUserRole: 'admin', access: { admin: true } });
    }
  });
  it('an admin may open either section', () => {
    expect(run({ profile: { ...complete, role: 'admin', gender: 'female' }, deviceSection: 'boys' }).kind).toBe('enter');
  });
  it('an admin without a name gets one, and still has to finish their profile if the data is missing', () => {
    const d = run({ profile: { role: 'admin', email: 'a@x.com' } });
    expect(d.kind).toBe('incomplete-profile');
    if (d.kind === 'incomplete-profile') {
      expect(d.session.currentUserName).toBe('الأدمن');
    }
  });
  it('an email alone makes nobody an admin: an account with no record is not registered, whatever its address', () => {
    expect(run({ profile: null, user: { uid: 'a', email: 'admin@x.com' } })).toEqual({ kind: 'blocked', reason: 'unregistered' });
  });
});

describe('servants with the old fields', () => {
  it('enters with their class from the old grade field', () => {
    const d = run({});
    expect(d.kind).toBe('enter');
    if (d.kind === 'enter') {
      expect(d.session).toMatchObject({ currentUserRole: 'deacon', currentUserName: 'مينا', currentUserGrade: 'سنة رابعة ابتدائي', accessSource: 'legacy' });
      expect(d.session.access.cells).toEqual(['male:4']);
    }
  });
  it('a servant without a class is refused', () => expect(run({ profile: { ...complete, grade: null } })).toEqual({ kind: 'blocked', reason: 'no-class' }));
  it('a phase lead without their own class still gets in through the phase grades', () => {
    const d = run({ profile: { ...complete, grade: null, isPhaseLead: true, phaseGrades: ['سنة تالتة ابتدائي'] } });
    expect(d.kind).toBe('enter');
    if (d.kind === 'enter') {
      expect(d.session).toMatchObject({ currentUserIsPhaseLead: true, currentUserPhaseGrades: ['سنة تالتة ابتدائي'] });
    }
  });
  it('the name falls back to the email when the account has none', () => {
    const d = run({ profile: { ...complete, name: undefined } });
    if (d.kind === 'enter') {
      expect(d.session.currentUserName).toBe('m@x.com');
    }
  });
});

describe('sections', () => {
  const girl: UserDoc = { ...complete, gender: 'female' };
  it('a girl on the boys device is sent to the girls section', () => {
    expect(run({ profile: girl })).toEqual({ kind: 'redirect-section', target: 'girls' });
  });
  it('...but if the redirect already happened and did not stick, she is refused', () => {
    expect(run({ profile: girl, redirectedTo: 'girls' })).toEqual({ kind: 'blocked', reason: 'wrong-section' });
  });
  it('a girl on the girls device enters', () => expect(run({ profile: girl, deviceSection: 'girls' }).kind).toBe('enter'));
});

describe('role-based access', () => {
  const withRoles = (cells: string[]): UserDoc => ({ ...complete, grade: null, access: { admin: false, cells } });
  it('takes the class from the roles, not from the old fields, and switches the old lead flags off', () => {
    const d = run({ profile: { ...withRoles(['male:3', 'male:5']), isLead: true } });
    expect(d.kind).toBe('enter');
    if (d.kind === 'enter') {
      expect(d.session).toMatchObject({ currentUserGrade: 'سنة تالتة ابتدائي', currentUserIsLead: false, currentUserPhaseGrades: [], accessSource: 'roles' });
    }
  });
  it('roles with no class at all show "no access yet"', () => expect(run({ profile: withRoles([]) })).toEqual({ kind: 'blocked', reason: 'no-access' }));
  it('roles of the girls section on a boys device send the person to the girls section', () => {
    expect(run({ profile: withRoles(['female:3']) })).toEqual({ kind: 'redirect-section', target: 'girls' });
  });
  it('grades 1-2 count as the girls section, also for the boys of that class', () => {
    expect(run({ profile: withRoles(['female:1', 'male:1']), deviceSection: 'girls' }).kind).toBe('enter');
  });
});

describe('finishing the profile', () => {
  it('an allowed servant with missing data is sent to finish it first', () => {
    const d = run({ profile: { ...complete, address: '' } });
    expect(d.kind).toBe('incomplete-profile');
  });
});

describe('loadAccountDecision (reads the account, and does the two things that belong to the check)', () => {
  const person = { uid: 'u1', email: 'm@x.com' } as User;
  const found = (data: UserDoc | null) => ({ exists: () => data !== null, data: () => data });

  beforeEach(() => {
    vi.mocked(getDocFast).mockReset();
    vi.mocked(loadProfileCache).mockReset();
    vi.mocked(switchDeviceToSection).mockReset().mockReturnValue(true);
    vi.mocked(sendUnauthorizedAlert).mockReset().mockResolvedValue(undefined);
    sessionStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('reads the account and decides', async () => {
    vi.mocked(getDocFast).mockResolvedValue(found(complete));
    expect((await loadAccountDecision(person)).kind).toBe('enter');
  });

  it('uses the copy cached on this device when the read finds nothing (offline)', async () => {
    vi.mocked(getDocFast).mockResolvedValue(null);
    vi.mocked(loadProfileCache).mockReturnValue(complete);
    expect((await loadAccountDecision(person)).kind).toBe('enter');
  });

  it('an account with no record alerts the admin by email, and is blocked', async () => {
    vi.mocked(getDocFast).mockResolvedValue(found(null));
    vi.mocked(loadProfileCache).mockReturnValue(null);
    expect(await loadAccountDecision(person)).toEqual({ kind: 'blocked', reason: 'unregistered' });
    expect(sendUnauthorizedAlert).toHaveBeenCalledWith('m@x.com', 'u1');
  });

  it('...but not when offline: that may only be a connection problem, so no false alarm', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    vi.mocked(getDocFast).mockResolvedValue(null);
    vi.mocked(loadProfileCache).mockReturnValue(null);
    expect(await loadAccountDecision(person)).toEqual({ kind: 'blocked', reason: 'unverifiable' });
    expect(sendUnauthorizedAlert).not.toHaveBeenCalled();
  });

  it('a pending account sends no alert', async () => {
    vi.mocked(getDocFast).mockResolvedValue(found({ ...complete, status: 'pending' }));
    await loadAccountDecision(person);
    expect(sendUnauthorizedAlert).not.toHaveBeenCalled();
  });

  it('an account of the other section: this device is switched, the attempt is remembered, and the page is to reload', async () => {
    vi.mocked(getDocFast).mockResolvedValue(found({ ...complete, gender: 'female' }));
    expect(await loadAccountDecision(person)).toEqual({ kind: 'redirect-section', target: 'girls' });
    expect(switchDeviceToSection).toHaveBeenCalledWith('girls');
    expect(sessionStorage.getItem('sectionRedirect')).toBe('girls');
  });

  it('if the browser refuses to switch, the account is blocked instead', async () => {
    vi.mocked(switchDeviceToSection).mockReturnValue(false);
    vi.mocked(getDocFast).mockResolvedValue(found({ ...complete, gender: 'female' }));
    expect(await loadAccountDecision(person)).toEqual({ kind: 'blocked', reason: 'wrong-section' });
  });

  it('a second attempt after the page was already reloaded once is blocked (no endless reload)', async () => {
    sessionStorage.setItem('sectionRedirect', 'girls');
    vi.mocked(getDocFast).mockResolvedValue(found({ ...complete, gender: 'female' }));
    expect(await loadAccountDecision(person)).toEqual({ kind: 'blocked', reason: 'wrong-section' });
    expect(switchDeviceToSection).not.toHaveBeenCalled();
  });
});
