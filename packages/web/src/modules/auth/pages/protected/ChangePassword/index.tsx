import { useState } from 'react';
import { Button } from '@heroui/react';
import { ArrowRight } from 'lucide-react';
import typia from 'typia';
import PageBody from '@/shared/components/layout/PageBody';
import PageHeader from '@/shared/components/layout/PageHeader';
import SettingsSection from '@/shared/components/SettingsSection';
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
            <PageHeader eyebrow='Settings / Account' title='Change password' />

            <div className='mt-10'>
                <SettingsSection
                    title='New password'
                    description='We ask for the current one first so a left-open session cannot change it.'
                >
                    <Form form={form} className='flex max-w-md flex-col gap-4'>
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

                        <div className='flex items-center gap-4'>
                            <Button type='submit' isPending={form.submitting} isDisabled={!form.isValid}>
                                Update password
                                <ArrowRight aria-hidden='true' className='size-4' />
                            </Button>
                            {saved && <span className='label-caps text-muted'>Password updated.</span>}
                        </div>
                    </Form>
                </SettingsSection>
            </div>
        </PageBody>
    );
};

export default ChangePassword;
