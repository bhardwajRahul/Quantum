import type { IValidation } from 'typia';
import type { FormEvent } from 'react';

export type Validator<T> = (input: unknown) => IValidation<T>;

export interface UseFormOptions<T>{
    validate: Validator<T>;
    initialValues: T;
    onSubmit: (values: T) => void | Promise<void>;
    validateOn?: 'blur' | 'change' | 'submit';
    submitErrorMessages?: Readonly<Partial<Record<string, string>>>;
    submitErrorFields?: Readonly<Partial<Record<string, keyof T & string>>>;
}

export interface FieldBinding<V>{
    name: string;
    value: V;
    onChange: (value: V) => void;
    onBlur: () => void;
    isInvalid: boolean;
    errorMessage: string | undefined;
}

export interface FormApi<T>{
    values: T;
    errors: Partial<Record<keyof T, string>>;
    submitting: boolean;
    submitError: string | null;
    isValid: boolean;
    field: <K extends keyof T>(name: K) => FieldBinding<T[K]>;
    handleSubmit: (event?: FormEvent) => void;
    setValues: (patch: Partial<T>) => void;
    reset: () => void;
}

export type ErrorMap = Partial<Record<string, string>>;

export type TouchedMap = Partial<Record<string, boolean>>;
