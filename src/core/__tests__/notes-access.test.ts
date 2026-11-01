import { hasSpiritualNotes, SPIRITUAL_NOTES_GRADES } from '@/core/notes-access';

describe('hasSpiritualNotes (which classes have the نوتة روحية tab)', () => {
  it('the trial is the 4th class of the boys only', () => {
    expect(SPIRITUAL_NOTES_GRADES).toEqual(['سنة رابعة ابتدائي']);
    expect(hasSpiritualNotes('سنة رابعة ابتدائي', 'boys')).toBe(true);
  });
  it('no other class has it, and the girls\' section never does', () => {
    expect(hasSpiritualNotes('سنة تالتة ابتدائي', 'boys')).toBe(false);
    expect(hasSpiritualNotes('سنة رابعة ابتدائي', 'girls')).toBe(false);
    expect(hasSpiritualNotes(null, 'boys')).toBe(false);
    expect(hasSpiritualNotes(undefined, 'boys')).toBe(false);
  });
});
