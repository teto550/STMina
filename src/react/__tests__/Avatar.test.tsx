import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Avatar, initialsOf } from '@/react/components/ui/avatar';
import ServantsList from '@/react/screens/servants-list';

describe('initialsOf', () => {
  it('uses the first letter for an Arabic name and the first two words for a Latin one', () => {
    expect(initialsOf('مينا باسم')).toBe('م');
    expect(initialsOf('ابادير امجد سامح')).toBe('ا');
    expect(initialsOf('Mina Bassem Samir')).toBe('MB');
    expect(initialsOf('  مينا  ')).toBe('م');
  });

  it('falls back to a question mark when the name is empty', () => {
    expect(initialsOf('')).toBe('؟');
    expect(initialsOf('   ')).toBe('؟');
  });
});

describe('Avatar', () => {
  it('shows the photo when there is one', () => {
    render(<Avatar name="مينا" src="data:image/jpeg;base64,AAAA" />);
    expect(screen.getByRole('img', { name: 'مينا' })).toHaveAttribute('src', 'data:image/jpeg;base64,AAAA');
  });

  it('shows the initials without a photo', () => {
    render(<Avatar name="مينا باسم" />);
    expect(screen.getByText('م')).toBeInTheDocument();
  });

  it('falls back to the initials when the photo cannot be loaded', () => {
    render(<Avatar name="مينا باسم" src="broken" />);
    fireEvent.error(screen.getByRole('img', { name: 'مينا باسم' }));
    expect(screen.getByText('م')).toBeInTheDocument();
  });

  it('is a button when it has an onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Avatar name="مينا" onClick={onClick} />);
    await user.click(screen.getByRole('button', { name: 'مينا' }));
    expect(onClick).toHaveBeenCalled();
  });
});

describe('Avatar without a name', () => {
  it('shows a person icon and the given accessible name', () => {
    render(<Avatar name="" label="صورة المخدوم" />);
    expect(screen.getByRole('img', { name: 'صورة المخدوم' })).toBeInTheDocument();
  });
});

describe('servants list rows', () => {
  it('show the servant photo when they have one and the initials otherwise', () => {
    render(
      <ServantsList
        rows={[
          { name: 'مينا باسم', grade: '', registered: true, sunday: 0, meeting: 0, photo: 'data:image/jpeg;base64,AAAA' },
          { name: 'مارك سمير', grade: '', registered: true, sunday: 0, meeting: 0 },
        ]}
        onOpen={() => undefined}
      />,
    );
    expect(document.querySelector('img[src="data:image/jpeg;base64,AAAA"]')).not.toBeNull();
    expect(screen.getByText('م', { selector: 'span[aria-hidden]' })).toBeInTheDocument();
  });
});
