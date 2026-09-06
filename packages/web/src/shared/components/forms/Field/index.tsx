import { TextField, Label, Input, TextArea, FieldError } from '@heroui/react';
import type { ReactNode } from 'react';
import type { FieldBinding, FormApi } from '@/shared/contracts/form';

interface FieldProps<T extends object>{
    form: FormApi<T>;
    name: keyof T & string;
    label?: string;
    type?: string;
    placeholder?: string;
    autoComplete?: string;
    multiline?: boolean;
    children?: (binding: FieldBinding<unknown>) => ReactNode;
}

const Field = <T extends object>({
    form,
    name,
    label,
    type = 'text',
    placeholder,
    autoComplete,
    multiline,
    children
}: FieldProps<T>) => {
    const binding = form.field(name);

    if(children) return <>{children(binding as FieldBinding<unknown>)}</>;

    const text = binding as unknown as FieldBinding<string>;

    return (
        <TextField
            name={text.name}
            type={type}
            value={text.value ?? ''}
            onChange={text.onChange}
            onBlur={text.onBlur}
            isInvalid={text.isInvalid}
            isDisabled={form.submitting}
            validationBehavior='aria'
            fullWidth
        >
            {label ? <Label>{label}</Label> : null}
            {multiline
                ? <TextArea rows={3} placeholder={placeholder} />
                : <Input placeholder={placeholder} autoComplete={autoComplete} />}
            <FieldError>{text.errorMessage}</FieldError>
        </TextField>
    );
};

export default Field;
