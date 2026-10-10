import { zodResolver } from '@hookform/resolvers/zod';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { vi } from 'vitest';
import { z } from 'zod';
import { PasswordField } from '@/react/components/form/PasswordField';
import { SelectField } from '@/react/components/form/SelectField';
import { TextField } from '@/react/components/form/TextField';

const schema = z.object({ name: z.string().min(1, 'اكتب الاسم'), pass: z.string().min(1, 'اكتب الباسورد'), color: z.string().min(1, 'اختار لون') });
type Values = z.infer<typeof schema>;

function Demo({ onSubmit, onColor }: { onSubmit: (v: Values) => void; onColor?: () => void }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', pass: '', color: '' } });
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <TextField name="name" label="الاسم" placeholder="اسمك" />
        <PasswordField name="pass" label="كلمة المرور" />
        <SelectField name="color" label="اللون" placeholder="اختر" options={[{ value: 'red', label: 'أحمر' }, { value: 'blue' }]} onChange={onColor} />
        <button type="submit">ارسل</button>
      </form>
    </FormProvider>
  );
}

describe('form fields (inside a react-hook-form FormProvider)', () => {
  it('each shows its own validation message after a failed submit', async () => {
    const onSubmit = vi.fn();
    render(<Demo onSubmit={onSubmit} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'ارسل' }));
    expect(await screen.findByText('اكتب الاسم')).toBeInTheDocument();
    expect(screen.getByText('اكتب الباسورد')).toBeInTheDocument();
    expect(screen.getByText('اختار لون')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('feed their values into the form and submit them', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Demo onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText('الاسم'), 'مينا');
    await user.type(screen.getByLabelText('كلمة المرور'), 'secret');
    await user.selectOptions(screen.getByLabelText('اللون'), 'blue');
    await user.click(screen.getByRole('button', { name: 'ارسل' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0]).toEqual({ name: 'مينا', pass: 'secret', color: 'blue' });
  });

  it('the select shows labels (or the value when there is no label) and the empty first option', () => {
    render(<Demo onSubmit={vi.fn()} />);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['اختر', 'أحمر', 'blue']);
  });

  it('the select tells its owner when the choice changes', async () => {
    const onColor = vi.fn();
    render(<Demo onSubmit={vi.fn()} onColor={onColor} />);
    await userEvent.setup().selectOptions(screen.getByLabelText('اللون'), 'red');
    expect(onColor).toHaveBeenCalledTimes(1);
  });

  it('the password field hides the text and has the eye', async () => {
    const user = userEvent.setup();
    render(<Demo onSubmit={vi.fn()} />);
    const pass = screen.getByLabelText('كلمة المرور');
    expect(pass).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'إظهار كلمة المرور' }));
    expect(pass).toHaveAttribute('type', 'text');
  });
});
