import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReactCheck from '@/react/screens/ReactCheck';

describe('ReactCheck form', () => {
  it('shows a validation message and does not save an invalid form', async () => {
    render(<ReactCheck />);
    await userEvent.type(screen.getByLabelText('اسم الدور'), 'a');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('حرفين');
    expect(screen.queryByTestId('saved')).not.toBeInTheDocument();
  });

  it('saves a valid form with the typed values', async () => {
    render(<ReactCheck />);
    await userEvent.type(screen.getByLabelText('اسم الدور'), 'خدام رابعة بنين');
    await userEvent.selectOptions(screen.getByLabelText('النوع'), 'female');
    await userEvent.click(screen.getByLabelText('Admin (everything)'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByTestId('saved')).toHaveTextContent('"roleName":"خدام رابعة بنين","gender":"female","isAdmin":true');
  });
});
