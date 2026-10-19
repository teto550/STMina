import { canTakeAttendanceOn, classEmoji, cleanClassSettings, setKeptClassSettings, weekdayOf } from '@/core/class-settings';

afterEach(() => setKeptClassSettings({}));

describe('class settings rules', () => {
  it('weekdayOf reads Thursday and Friday as 4 and 5', () => {
    expect(weekdayOf('2026-10-22')).toBe(4);
    expect(weekdayOf('2026-10-23')).toBe(5);
  });

  it('a class with no day set can take attendance any day', () => {
    expect(canTakeAttendanceOn('سنة تالتة ابتدائي', '2026-10-21')).toBe(true);
  });

  it('a class with a day takes attendance on that day only', () => {
    setKeptClassSettings({ g: { serviceDay: 5 } });
    expect(canTakeAttendanceOn('g', '2026-10-23')).toBe(true);
    expect(canTakeAttendanceOn('g', '2026-10-22')).toBe(false);
  });

  it('the emoji falls back to the default', () => {
    expect(classEmoji('x')).toBe('📚');
    setKeptClassSettings({ x: { emoji: '🌟' } });
    expect(classEmoji('x')).toBe('🌟');
  });

  it('cleanClassSettings drops anything invalid', () => {
    expect(cleanClassSettings({ a: { emoji: ' 🌟 ', serviceDay: 9 }, b: { serviceDay: 4 }, c: {}, d: 5 })).toEqual({ a: { emoji: '🌟' }, b: { serviceDay: 4 } });
  });
});
