import { emptyRegister, type RegisterValues } from '@/schemas/auth';
import { toRegisterInput } from '@/react/screens/auth/register/to-input';

const values: RegisterValues = {
  ...emptyRegister, grade: 'سنة رابعة ابتدائي', name: ' يوسف ', email: 'y@x.com', phones: [{ value: ' 010 ' }, { value: '  ' }], address: ' القاهرة ', dob: '2000-01-01',
  status: 'student', college: ' هندسة ', university: 'جامعة القاهرة', password: 'secret1',
};

describe('toRegisterInput', () => {
  it('trims, drops blank phone rows, and keeps college and university for a student', () => {
    expect(toRegisterInput(values)).toEqual({
      grade: 'سنة رابعة ابتدائي', name: 'يوسف', email: 'y@x.com', phones: ['010'], address: 'القاهرة', dob: '2000-01-01',
      graduated: false, college: 'هندسة', university: 'جامعة القاهرة', password: 'secret1',
    });
  });
  it('a graduate sends no college or university', () => {
    expect(toRegisterInput({ ...values, status: 'graduated' })).toMatchObject({ graduated: true, college: '', university: '' });
  });
});
