import { render, screen } from '@testing-library/react';
import { Field } from '@/react/components/ui/field';

describe('Field', () => {
  it('ties the label to the control inside it', () => {
    render(<Field label="الاسم"><input /></Field>);
    expect(screen.getByLabelText('الاسم')).toBeInTheDocument();
  });
  it('shows the error under the control, announced as an alert, and nothing when there is none', () => {
    const { rerender } = render(<Field label="الاسم"><input /></Field>);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    rerender(<Field label="الاسم" error="اكتب الاسم"><input /></Field>);
    expect(screen.getByRole('alert')).toHaveTextContent('اكتب الاسم');
  });
});
