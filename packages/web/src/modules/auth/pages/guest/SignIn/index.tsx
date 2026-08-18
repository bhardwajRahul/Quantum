import { Button } from '@heroui/react';
import Form from '@/shared/components/forms/Form';
import Field from '@/shared/components/forms/Field';
import AuthShell from '@/modules/auth/components/AuthShell';
import Reveal from '@/modules/auth/components/Reveal';
import { useIdentifierFlow } from '@/modules/auth/hooks/use-identifier-flow';
import type { IdentifierStep } from '@/modules/auth/hooks/use-identifier-flow';

const TITLE: Record<IdentifierStep, string> = {
    email: 'Sign in to Quantum',
    password: 'Sign in to Quantum',
    signup: 'Create your account'
};

const SUBTITLE: Record<IdentifierStep, string> = {
    email: 'Your applications are waiting for you.',
    password: 'Your applications are waiting for you.',
    signup: 'Deploy and manage applications on Quantum.'
};

const SUBMIT_LABEL: Record<IdentifierStep, string> = {
    email: 'Continue',
    password: 'Sign in',
    signup: 'Create account'
};

const SignIn = () => {
    const { step, form, back } = useIdentifierFlow();

    return (
        <AuthShell>
            <h1 className='text-lg font-medium text-foreground'>{TITLE[step]}</h1>
            <p className='mt-1.5 text-sm text-muted'>{SUBTITLE[step]}</p>

            <Form form={form} className='mt-6 flex flex-col gap-4'>
                <Field form={form} name='email' label='Email' type='email' placeholder='Email' autoComplete='email' />

                <Reveal show={step === 'signup'}>
                    <Field form={form} name='fullname' label='Full name' placeholder='Full name' autoComplete='name' />
                    <Field form={form} name='username' label='Username' placeholder='Username' autoComplete='username' />
                </Reveal>

                <Reveal show={step !== 'email'}>
                    <Field
                        form={form}
                        name='password'
                        label='Password'
                        type='password'
                        placeholder='Password'
                        autoComplete={step === 'signup' ? 'new-password' : 'current-password'}
                    />
                </Reveal>

                <Reveal show={step === 'signup'}>
                    <Field
                        form={form}
                        name='passwordConfirm'
                        label='Confirm password'
                        type='password'
                        placeholder='Confirm password'
                        autoComplete='new-password'
                    />
                </Reveal>

                {step !== 'email' && (
                    <button
                        type='button'
                        onClick={back}
                        className='self-start text-xs text-muted transition-colors hover:text-foreground'
                    >
                        Back
                    </button>
                )}

                <Button type='submit' fullWidth className='mt-1' isPending={form.submitting}>
                    {SUBMIT_LABEL[step]}
                </Button>
            </Form>
        </AuthShell>
    );
};

export default SignIn;
