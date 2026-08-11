import { Button } from '@heroui/react';
import { Link as RouterLink } from 'react-router-dom';
import typia from 'typia';
import Form from '@/shared/components/forms/Form';
import Field from '@/shared/components/forms/Field';
import AuthShell from '@/modules/auth/components/AuthShell';
import { useForm } from '@/shared/hooks/forms/use-form';
import { authApi } from '@/modules/auth/api/api';
import { authErrorMessages, signUpErrorFields } from '@/modules/auth/utils/error-messages';
import { useSessionStore } from '@/shared/store/session';
import type { SignUpInput } from '@quantum/contracts/modules/auth/http';

const SignUp = () => {
    const setToken = useSessionStore((state) => state.setToken);

    const form = useForm<SignUpInput>({
        validate: typia.createValidate<SignUpInput>(),
        submitErrorMessages: authErrorMessages,
        submitErrorFields: signUpErrorFields,
        initialValues: { username: '', fullname: '', email: '', password: '', passwordConfirm: '' },
        onSubmit: async (values) => {
            const session = await authApi.signUp(values);
            setToken(session.token);
        }
    });

    return (
        <AuthShell>
            <h1 className='text-lg font-medium text-foreground'>Create your account</h1>
            <p className='mt-1.5 text-sm text-muted'>Deploy and manage applications on Quantum.</p>

            <Form form={form} className='mt-6 flex flex-col gap-4'>
                <Field form={form} name='email' label='Email' type='email' placeholder='Email' autoComplete='email' />

                <Field form={form} name='username' label='Username' placeholder='Username' autoComplete='username' />

                <Field form={form} name='fullname' label='Full name' placeholder='Full name' autoComplete='name' />

                <Field
                    form={form}
                    name='password'
                    label='Password'
                    type='password'
                    placeholder='Password'
                    autoComplete='new-password'
                />

                <Field
                    form={form}
                    name='passwordConfirm'
                    label='Confirm password'
                    type='password'
                    placeholder='Confirm password'
                    autoComplete='new-password'
                />

                <Button type='submit' fullWidth className='mt-1' isPending={form.submitting}>
                    Create account
                </Button>
            </Form>

            <p className='mt-7 text-center text-xs text-muted'>
                Already have an account?{' '}
                <RouterLink to='/sign-in' className='text-foreground'>Sign in</RouterLink>
            </p>
        </AuthShell>
    );
};

export default SignUp;
