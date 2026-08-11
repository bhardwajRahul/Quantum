import { useRef, useState } from 'react';
import { ApiError } from '@/shared/services/ApiError';
import type { FormEvent } from 'react';
import type { IValidation } from 'typia';
import type { ErrorMap, FieldBinding, FormApi, TouchedMap, UseFormOptions } from '@/shared/contracts/form';

const fieldErrorsFromBody = (body: unknown): ErrorMap | null => {
    if(!body || typeof body !== 'object') return null;
    const detail = (body as { errors?: unknown }).errors;
    if(!detail || typeof detail !== 'object') return null;

    const map: ErrorMap = {};
    for(const [key, value] of Object.entries(detail as Record<string, unknown>)){
        if(typeof value === 'string') map[key] = value;
    }
    return Object.keys(map).length > 0 ? map : null;
};

const messageFor = ({ expected, value }: IValidation.IError): string => {
    const length = typeof value === 'string' ? value.length : null;

    const min = expected.match(/MinLength<(\d+)>/);
    if(min && length !== null && length < Number(min[1])){
        return min[1] === '1' ? 'Required' : `At least ${min[1]} characters`;
    }

    const max = expected.match(/MaxLength<(\d+)>/);
    if(max && length !== null && length > Number(max[1])){
        return `At most ${max[1]} characters`;
    }

    if(expected.includes('Format<"email">')) return 'Invalid email';
    return 'Invalid value';
};

const fieldKeyOf = (path: string): string => path.replace(/^\$input\./, '').split('.')[0];

export const useForm = <T extends object>({
    validate: validateInput,
    initialValues,
    onSubmit,
    validateOn = 'blur',
    submitErrorMessages,
    submitErrorFields
}: UseFormOptions<T>): FormApi<T> => {
    const initialRef = useRef(initialValues);
    const [values, setValuesState] = useState<T>(initialValues);
    const [errors, setErrors] = useState<ErrorMap>({});
    const [submitting, setSubmittingState] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const valuesRef = useRef(values);
    const touchedRef = useRef<TouchedMap>({});
    const submittingRef = useRef(submitting);

    const commitValues = (next: T) => {
        valuesRef.current = next;
        setValuesState(next);
    };

    const commitSubmitting = (next: boolean) => {
        submittingRef.current = next;
        setSubmittingState(next);
    };

    const mergeValues = (base: T, patch: Partial<T>): T => ({ ...base, ...patch });

    const validate = (input: T): ErrorMap => {
        const result = validateInput(input);
        if(result.success) return {};

        const map: ErrorMap = {};
        for(const error of result.errors){
            const key = fieldKeyOf(error.path);
            if(!(key in map)) map[key] = messageFor(error);
        }
        return map;
    };

    const applyFieldError = (key: string, map: ErrorMap) => {
        setErrors((prev) => {
            const next = { ...prev };
            if(map[key]) next[key] = map[key];
            else delete next[key];
            return next;
        });
    };

    const handleChange = (key: string, value: unknown) => {
        const next = mergeValues(valuesRef.current, { [key]: value } as Partial<T>);
        commitValues(next);
        if(validateOn === 'change' || touchedRef.current[key]) applyFieldError(key, validate(next));
    };

    const handleBlur = (key: string) => {
        touchedRef.current[key] = true;
        if(validateOn === 'submit') return;

        if(submittingRef.current) return;
        applyFieldError(key, validate(valuesRef.current));
    };

    const applySubmitError = (error: unknown) => {
        if(error instanceof ApiError){
            const fieldErrors = fieldErrorsFromBody(error.body);
            if(fieldErrors) setErrors((prev) => ({ ...prev, ...fieldErrors }));

            const message = submitErrorMessages?.[error.message] ?? error.message;
            const field = submitErrorFields?.[error.message];
            if(field) setErrors((prev) => ({ ...prev, [field]: message }));
            setSubmitError(message);
            return;
        }
        setSubmitError(error instanceof Error ? error.message : 'Something went wrong');
    };

    const handleSubmit = (event?: FormEvent) => {
        event?.preventDefault();
        if(submittingRef.current) return;

        const current = valuesRef.current;
        const map = validate(current);
        for(const key of Object.keys(current)) touchedRef.current[key] = true;
        setErrors(map);
        if(Object.keys(map).length > 0) return;

        setSubmitError(null);
        commitSubmitting(true);
        Promise.resolve()
            .then(() => onSubmit(current))
            .then(() => commitSubmitting(false))
            .catch((error: unknown) => {
                commitSubmitting(false);
                applySubmitError(error);
            });
    };

    const field = <K extends keyof T>(name: K): FieldBinding<T[K]> => {
        const key = name as string;
        return {
            name: key,
            value: values[name],
            onChange: (value) => handleChange(key, value),
            onBlur: () => handleBlur(key),
            isInvalid: errors[key] !== undefined,
            errorMessage: errors[key]
        };
    };

    const setValues = (patch: Partial<T>) => {
        commitValues(mergeValues(valuesRef.current, patch));
        setErrors((prev) => {
            const next = { ...prev };
            for(const key of Object.keys(patch)) delete next[key];
            return next;
        });
    };

    const reset = () => {
        commitValues(initialRef.current);
        setErrors({});
        touchedRef.current = {};
        commitSubmitting(false);
        setSubmitError(null);
    };

    return {
        values,
        errors: errors as Partial<Record<keyof T, string>>,
        submitting,
        submitError,
        isValid: validateInput(values).success,
        field,
        handleSubmit,
        setValues,
        reset
    };
};
