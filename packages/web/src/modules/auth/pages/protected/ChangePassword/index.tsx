import { useState } from 'react';
import { Button } from '@heroui/react';
import typia from 'typia';
import PageBody from '@/shared/components/layout/PageBody';
import Form from '@/shared/components/forms/Form';
import Field from '@/shared/components/forms/Field';
import { useForm } from '@/shared/hooks/forms/use-form';
import { authApi } from '@/modules/auth/api/api';
import { authErrorMessages } from '@/modules/auth/utils/error-messages';
import { useSessionStore } from '@/shared/store/session';
import type { AuthSubmitErrorCode } from '@/modules/auth/utils/error-messages';
import type { UpdatePasswordInput } from '@quantum/contracts/modules/auth/http';

const changePasswordErrorFields: Partial<Record<AuthSubmitErrorCode, keyof UpdatePasswordInput>> = {
    'Authentication::PasswordConfirmMismatch': 'passwordConfirm'
};

const ChangePassword = () => {
    const [saved, setSaved] = useState(false);
    const setToken = useSessionStore((state) => state.setToken);

    const form = useForm<UpdatePasswordInput>({
        validate: typia.createValidate<UpdatePasswordInput>(),
        submitErrorMessages: authErrorMessages,
        submitErrorFields: changePasswordErrorFields,
        initialValues: { passwordCurrent: '', password: '', passwordConfirm: '' },
        onSubmit: async (values) => {
            const session = await authApi.updatePassword({ body: values });
            setToken(session.token);
            form.reset();
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        }
    });

    return (
        <PageBody>
            <h1 className='mb-6 text-2xl font-semibold text-foreground'>Change password</h1>

            <div className='rounded-2xl bg-foreground/[0.04] p-5'>
                    <Form form={form} className='flex flex-col gap-4'>
                        <Field
                            form={form}
                            name='passwordCurrent'
                            label='Current password'
                            type='password'
                            placeholder='Current password'
                            autoComplete='current-password'
                        />

                        <Field
                            form={form}
                            name='password'
                            label='New password'
                            type='password'
                            placeholder='New password'
                            autoComplete='new-password'
                        />

                        <Field
                            form={form}
                            name='passwordConfirm'
                            label='Confirm new password'
                            type='password'
                            placeholder='Confirm new password'
                            autoComplete='new-password'
                        />

                        <div className='flex items-center gap-3'>
                            <Button type='submit' isPending={form.submitting} isDisabled={!form.isValid}>
                                Save
                            </Button>
                            {saved && <span className='text-[0.8125rem] text-muted'>Password updated.</span>}
                        </div>
                    </Form>
            </div>
        </PageBody>
    );
};

export default ChangePassword;
