import { useMemo, type FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { Case, Switch } from 'react-if';
import { GRADES, SECTION } from '@/core/section';
import { SelectField } from '@/react/components/form/SelectField';
import { Alert } from '@/react/components/ui/alert';
import { Button } from '@/react/components/ui/button';
import { Spinner } from '@/react/components/ui/spinner';
import { useRoster } from '@/react/hooks/useServants';
import type { RegisterValues } from '@/schemas/auth';
import type { Section } from '@/types/access';

/** The states of the names list: loading, error, empty, then the data (always in this order). */
enum NamesView {
  Loading = 'loading',
  Failed = 'failed',
  Empty = 'empty',
  Ready = 'ready',
}

const viewOf = (loading: boolean, failed: boolean, empty: boolean): NamesView => {
  if (loading) {
    return NamesView.Loading;
  }
  if (failed) {
    return NamesView.Failed;
  }
  if (empty) {
    return NamesView.Empty;
  }
  return NamesView.Ready;
};

/** The class the servant will serve in, and their own name picked from that class's servants list (loaded with a visible loader). */
export const ClassAndNameFields: FC = () => {
  const { watch, setValue } = useFormContext<RegisterValues>();
  const roster = useRoster(SECTION as Section);
  const grade = watch('grade');
  const names = useMemo(
    () => (roster.data ?? []).filter((r) => r.grade === grade).map((r) => r.name).sort((a, b) => a.localeCompare(b, 'ar')),
    [roster.data, grade],
  );
  const view = viewOf(roster.isFetching, roster.isError, !!grade && names.length === 0);

  return (
    <>
      <SelectField name="grade" label="السنة الدراسية اللي هتخدم فيها *" placeholder="اختر السنة الدراسية" options={(GRADES as string[]).map((g) => ({ value: g }))} onChange={() => setValue('name', '')} />
      <Switch>
        <Case condition={view === NamesView.Loading}>
          <Spinner label="جاري تحميل الأسماء…" />
        </Case>
        <Case condition={view === NamesView.Failed}>
          <Alert action={<Button type="button" size="sm" variant="outline" onClick={() => void roster.refetch()}>حاول تاني</Button>}>
            مقدرناش نحمّل أسماء الخدام
          </Alert>
        </Case>
        <Case condition={view === NamesView.Empty}>
          <Alert tone="info">لا يوجد خدام مسجلين في السنة دي — كلم الأدمن</Alert>
        </Case>
        <Case condition={view === NamesView.Ready}>
          <SelectField name="name" label="الاسم الكامل *" disabled={!grade} placeholder={grade ? 'اختر اسمك من القائمة' : 'اختر السنة الدراسية الأول'} options={names.map((n) => ({ value: n }))} />
        </Case>
      </Switch>
    </>
  );
};
