import { render, screen } from '@testing-library/react';
import { Spinner } from '@/react/components/ui/spinner';

describe('Spinner', () => {
  it('is a status with a default name, so a screen reader says something is loading', () => {
    render(<Spinner />);
    expect(screen.getByRole('status', { name: 'جاري التحميل' })).toBeInTheDocument();
  });
  it('shows the label when there is one, and uses it as the name', () => {
    render(<Spinner label="جاري تحميل الأسماء…" />);
    expect(screen.getByRole('status', { name: 'جاري تحميل الأسماء…' })).toHaveTextContent('جاري تحميل الأسماء…');
  });
});
