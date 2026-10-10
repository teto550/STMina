import type { RegisterInput } from '@/api/auth';
import { cleanPhones } from '@/schemas/common';
import type { RegisterValues } from '@/schemas/auth';

/** The registration form's values, as the API wants them: trimmed, blank phone rows gone, college/university only for students. */
export function toRegisterInput(v: RegisterValues): RegisterInput {
  const student = v.status === 'student';
  return {
    grade: v.grade, name: v.name.trim(), email: v.email, phones: cleanPhones(v.phones), address: v.address.trim(), dob: v.dob,
    graduated: v.status === 'graduated', college: student ? v.college.trim() : '', university: student ? v.university : '', password: v.password,
  };
}
