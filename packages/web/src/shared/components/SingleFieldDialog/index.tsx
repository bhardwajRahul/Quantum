import { Button } from '@heroui/react';
import type { ReactNode } from 'react';
import Modal from '@/shared/components/Modal';
import Form from '@/shared/components/forms/Form';
import Field from '@/shared/components/forms/Field';
import type { FormApi } from '@/shared/contracts/form';

interface SingleFieldDialogProps<T extends object>{
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    title: string;
    description?: string;
    form: FormApi<T>;
    fieldName: keyof T & string;
    fieldLabel: string;
    fieldPlaceholder?: string;
    fieldType?: string;
    extra?: ReactNode;
    extraPosition?: 'before' | 'after';
    submitLabel: string;
    submitDisabled?: boolean;
    onCancel: () => void;
}

const SingleFieldDialog = <T extends object>({
    isOpen,
    onOpenChange,
    title,
    description,
    form,
    fieldName,
    fieldLabel,
    fieldPlaceholder,
    fieldType = 'text',
    extra,
    extraPosition = 'after',
    submitLabel,
    submitDisabled,
    onCancel
}: SingleFieldDialogProps<T>) => (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} title={title}>
        <Form form={form} className='flex flex-col gap-4'>
            {description !== undefined && <p className='text-[0.875rem] text-muted'>{description}</p>}

            {extra !== undefined && extraPosition === 'before' ? extra : null}

            <Field
                form={form}
                name={fieldName}
                label={fieldLabel}
                type={fieldType}
                placeholder={fieldPlaceholder}
                autoComplete='off'
            />

            {extra !== undefined && extraPosition === 'after' ? extra : null}

            <div className='flex justify-end gap-2'>
                <Button variant='secondary' isDisabled={form.submitting} onPress={onCancel}>
                    Cancel
                </Button>
                <Button type='submit' isPending={form.submitting} isDisabled={submitDisabled}>{submitLabel}</Button>
            </div>
        </Form>
    </Modal>
);

export default SingleFieldDialog;
