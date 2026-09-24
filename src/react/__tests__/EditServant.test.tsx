import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const setDoc = vi.fn(async (..._a: unknown[]) => undefined);
const renameServant = vi.fn(async (..._a: unknown[]) => ({ ok: true, counts: { students: 3, attendance: 1, parts: 0, accounts: 1 }, partsFailed: false }));
vi.mock('@/core/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: (_db: unknown, col: string, id: string) => `${col}/${id}`, setDoc: (...a: unknown[]) => setDoc(...a) }));
vi.mock('@/core/servant-rename', () => ({ renameServant: (...a: unknown[]) => renameServant(...a) }));

import EditServant from '@/react/screens/EditServant';

const servant = { name: 'مينا باسم', uid: 'u1', personId: 'p1', phones: ['01000000000'], address: 'القاهرة', dob: '2000-01-01', graduated: false, college: 'هندسة', university: 'جامعة القاهرة' };

beforeEach(() => { setDoc.mockClear(); renameServant.mockClear(); });

describe('EditServant', () => {
  it('an admin can rename (a single word is fine): renames everywhere first, then saves the data', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<EditServant servant={servant} canRename onSaved={onSaved} close={() => undefined} />);
    const name = screen.getByLabelText('الاسم');
    await user.clear(name);
    await user.type(name, 'مينا');
    await user.click(screen.getByRole('button', { name: /حفظ/ }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(renameServant).toHaveBeenCalledWith('p1', 'مينا باسم', 'مينا');
    expect(setDoc).toHaveBeenCalledWith('users/u1', expect.objectContaining({ phones: ['01000000000'], phone: '01000000000', graduated: false }), { merge: true });
    expect(onSaved.mock.calls[0]![0]).toMatchObject({ name: 'مينا' });
  });

  it('a non-admin cannot change the name', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<EditServant servant={servant} canRename={false} onSaved={onSaved} close={() => undefined} />);
    expect(screen.getByLabelText(/^الاسم/)).toHaveAttribute('readonly');
    await user.click(screen.getByRole('button', { name: /حفظ/ }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(renameServant).not.toHaveBeenCalled();
  });

  it('needs at least one phone number', async () => {
    const user = userEvent.setup();
    render(<EditServant servant={{ ...servant, phones: [] }} canRename onSaved={() => undefined} close={() => undefined} />);
    await user.click(screen.getByRole('button', { name: /حفظ/ }));
    expect(await screen.findByText('اكتب رقم تليفون واحد على الأقل')).toBeInTheDocument();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('stops and shows the reason when the rename is refused, and saves nothing', async () => {
    renameServant.mockResolvedValueOnce({ ok: false, error: 'فيه خادم تاني بنفس الاسم ده' } as never);
    const user = userEvent.setup();
    render(<EditServant servant={servant} canRename onSaved={() => undefined} close={() => undefined} />);
    const name = screen.getByLabelText('الاسم');
    await user.clear(name);
    await user.type(name, 'بيتر');
    await user.click(screen.getByRole('button', { name: /حفظ/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('بنفس الاسم');
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('hides college and university for a graduate', async () => {
    const user = userEvent.setup();
    render(<EditServant servant={servant} canRename onSaved={() => undefined} close={() => undefined} />);
    expect(screen.getByLabelText('الكلية')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('الحالة الدراسية'), 'graduated');
    expect(screen.queryByLabelText('الكلية')).not.toBeInTheDocument();
  });

  it('a servant without an account can still be renamed: only the name is shown, nothing is written to users', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<EditServant servant={{ ...servant, uid: null, phones: [] }} canRename onSaved={onSaved} close={() => undefined} />);
    expect(screen.queryByLabelText(/رقم التليفون/)).not.toBeInTheDocument();
    expect(screen.getByText(/لسه ماسجلش بياناته/)).toBeInTheDocument();
    const name = screen.getByLabelText('الاسم');
    await user.clear(name);
    await user.type(name, 'مينا');
    await user.click(screen.getByRole('button', { name: /حفظ/ }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(renameServant).toHaveBeenCalledWith('p1', 'مينا باسم', 'مينا');
    expect(setDoc).not.toHaveBeenCalled();
  });
});
