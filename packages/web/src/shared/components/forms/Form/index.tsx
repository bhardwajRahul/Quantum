import InlineError from '@/shared/components/InlineError';
import type { ReactNode } from 'react';
import type { FormApi } from '@/shared/contracts/form';

interface FormProps<T extends object>{
    form: FormApi<T>;
    children: ReactNode;
    className?: string;
}

const Form = <T extends object>({ form, children, className }: FormProps<T>) => (
    <form noValidate className={className} onSubmit={form.handleSubmit}>
        <fieldset disabled={form.submitting} className='contents'>
            {children}
        </fieldset>
        {form.submitError ? (
            <InlineError className='text-sm'>{form.submitError}</InlineError>
        ) : null}
    </form>
);

export default Form;
