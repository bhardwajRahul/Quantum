import { Button } from '@heroui/react';
import { Link as RouterLink } from 'react-router-dom';
import typia from 'typia';
import Form from '@/shared/components/forms/Form';
import Field from '@/shared/components/forms/Field';
import AuthShell from '@/modules/auth/components/AuthShell';
import { useForm } from '@/shared/hooks/forms/use-form';
import { authApi } from '@/modules/auth/api/api';
import { authErrorMessages } from '@/modules/auth/utils/error-messages';
import { useSessionStore } from '@/shared/store/session';
import type { SignInInput } from '@quantum/contracts/modules/auth/http';

const SignIn = () => {
    const setToken = useSessionStore((state) => state.setToken);

    const form = useForm<SignInInput>({
        validate: typia.createValidate<SignInInput>(),
        submitErrorMessages: authErrorMessages,
        initialValues: { email: '', password: '' },
        onSubmit: async (values) => {
            const session = await authApi.signIn(values);
            setToken(session.token);
        }
    });

    return (
        <AuthShell>
            <h1 className='text-lg font-medium text-foreground'>Sign in to Quantum</h1>
            <p className='mt-1.5 text-sm text-muted'>Your applications are waiting for you.</p>

            <Form form={form} className='mt-6 flex flex-col gap-4'>
                <Field form={form} name='email' label='Email' type='email' placeholder='Email' autoComplete='email' />

                <Field
                    form={form}
                    name='password'
                    label='Password'
                    type='password'
                    placeholder='Password'
                    autoComplete='current-password'
                />

                <Button type='submit' fullWidth className='mt-1' isPending={form.submitting}>
                    Sign in
                </Button>
            </Form>

            <p className='mt-7 text-center text-xs text-muted'>
                No account yet?{' '}
                <RouterLink to='/sign-up' className='text-foreground'>Create one</RouterLink>
            </p>
        </AuthShell>
    );
};

export default SignIn;
