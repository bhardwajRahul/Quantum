import { Button } from '@heroui/react';
import { ArrowRight } from 'lucide-react';
import Form from '@/shared/components/forms/Form';
import Field from '@/shared/components/forms/Field';
import AuthShell from '@/modules/auth/components/AuthShell';
import Reveal from '@/modules/auth/components/Reveal';
import { useIdentifierFlow } from '@/modules/auth/hooks/use-identifier-flow';
import type { IdentifierStep } from '@/modules/auth/hooks/use-identifier-flow';

const EYEBROW: Record<IdentifierStep, string> = {
    email: 'Sign in',
    password: 'Sign in',
    signup: 'Sign up'
};

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
        <AuthShell aside={<span className='label-caps text-muted'>{step === 'signup' ? 'New account' : 'Welcome back'}</span>}>
            <p className='label-caps text-muted'>{EYEBROW[step]}</p>
            <h1 className='title-display mt-5 text-[2.75rem] leading-[1.02] text-foreground sm:text-[3.25rem]'>
                {TITLE[step]}
            </h1>
            <p className='mt-4 text-sm text-muted'>{SUBTITLE[step]}</p>

            <Form form={form} className='mt-10 flex flex-col'>
                <Field form={form} name='email' label='Email' type='email' placeholder='Email' autoComplete='email' />

                <Reveal show={step === 'signup'}>
                    <div className='grid gap-5 sm:grid-cols-2'>
                        <Field form={form} name='fullname' label='Full name' placeholder='Full name' autoComplete='name' />
                        <Field form={form} name='username' label='Username' placeholder='Username' autoComplete='username' />
                    </div>
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

                <div className='mt-7 flex items-center gap-6'>
                    <Button type='submit' isPending={form.submitting}>
                        {SUBMIT_LABEL[step]}
                        <ArrowRight aria-hidden='true' className='size-4' />
                    </Button>

                    {step !== 'email' && (
                        <button
                            type='button'
                            onClick={back}
                            className='label-caps text-muted transition-colors hover:text-foreground motion-reduce:transition-none'
                        >
                            Back
                        </button>
                    )}
                </div>
            </Form>
        </AuthShell>
    );
};

export default SignIn;
