import { cn } from '@/react/lib/utils';

describe('cn', () => {
  it('keeps the later of two conflicting prefixed utilities', () => {
    expect(cn('tw:p-2', 'tw:p-4')).toBe('tw:p-4');
  });
  it('drops falsy values and merges variants', () => {
    expect(cn('tw:flex', false && 'tw:hidden', undefined, 'tw:items-center')).toBe('tw:flex tw:items-center');
  });
  it('does not merge different prefixed properties', () => {
    expect(cn('tw:px-2', 'tw:py-4')).toBe('tw:px-2 tw:py-4');
  });
});
