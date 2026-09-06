import { useEffect, useState } from 'react';
import typia from 'typia';
import { useForm } from '@/shared/hooks/forms/use-form';
import { authApi } from '@/modules/auth/api/api';
import { authErrorMessages, signUpErrorFields } from '@/modules/auth/utils/error-messages';
import { useSessionStore } from '@/shared/store/session';
import type { CheckEmailInput, SignInInput, SignUpInput } from '@quantum/contracts/modules/auth/http';
import type { FormApi, Validator } from '@/shared/contracts/form';

export type IdentifierStep = 'email' | 'password' | 'signup';

const validators: Record<IdentifierStep, Validator<SignUpInput>> = {
    email: typia.createValidate<CheckEmailInput>() as unknown as Validator<SignUpInput>,
    password: typia.createValidate<SignInInput>() as unknown as Validator<SignUpInput>,
    signup: typia.createValidate<SignUpInput>()
};

export interface IdentifierFlow{
    step: IdentifierStep;
    form: FormApi<SignUpInput>;
    back: () => void;
}

export const useIdentifierFlow = (): IdentifierFlow => {
    const [step, setStep] = useState<IdentifierStep>('email');
    const setToken = useSessionStore((state) => state.setToken);

    const form = useForm<SignUpInput>({
        validate: validators[step],
        submitErrorMessages: authErrorMessages,
        submitErrorFields: signUpErrorFields,
        initialValues: { username: '', fullname: '', email: '', password: '', passwordConfirm: '' },
        onSubmit: async (values) => {
            if(step === 'email'){
                const { exists } = await authApi.checkEmail({ query: { email: values.email } });
                setStep(exists ? 'password' : 'signup');
                return;
            }

            if(step === 'password'){
                const session = await authApi.signIn({ body: { email: values.email, password: values.password } });
                setToken(session.token);
                return;
            }

            const session = await authApi.signUp({ body: values });
            setToken(session.token);
        }
    });

    useEffect(() => {
        setStep((current) => (current === 'email' ? current : 'email'));
    }, [form.values.email]);

    return { step, form, back: () => setStep('email') };
};
