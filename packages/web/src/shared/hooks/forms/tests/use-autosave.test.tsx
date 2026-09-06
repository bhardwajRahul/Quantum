import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { useAutosave } from '@/shared/hooks/forms/use-autosave';
import { useForm } from '@/shared/hooks/forms/use-form';
import { renderHook } from '@/shared/tests/render-hook';
import type { IValidation } from 'typia';

const DELAY_MS = 5;

const settle = (ms = DELAY_MS * 4) => act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
});

interface Values{
    name: string;
}

const validate = (input: unknown): IValidation<Values> => {
    const values = input as Values;
    if(values.name !== '') return { success: true, data: values };

    return {
        success: false,
        data: input,
        errors: [{ path: '$input.name', expected: 'string & MinLength<1>', value: values.name }]
    } as IValidation<Values>;
};

describe('useAutosave', () => {
    it('persists a changed value after the delay, with no save action', async () => {
        const save = vi.fn(() => Promise.resolve());
        let value: Values = { name: 'alpha' };

        const harness = await renderHook(() => useAutosave({ value, save, delayMs: DELAY_MS }));
        await settle();
        expect(save).not.toHaveBeenCalled();
        expect(harness.current.state).toBe('idle');

        value = { name: 'beta' };
        await harness.render();
        expect(harness.current.state).toBe('pending');

        await settle();
        expect(save).toHaveBeenCalledExactlyOnceWith({ name: 'beta' });
        expect(harness.current.state).toBe('saved');
    });

    it('coalesces a burst of edits into a single write', async () => {
        const save = vi.fn(() => Promise.resolve());
        let value: Values = { name: 'a' };

        const harness = await renderHook(() => useAutosave({ value, save, delayMs: DELAY_MS }));
        for(const name of ['ab', 'abc', 'abcd']){
            value = { name };
            await harness.render();
        }

        await settle();
        expect(save).toHaveBeenCalledExactlyOnceWith({ name: 'abcd' });
    });

    it('holds an invalid value back and keeps reporting it as unsaved', async () => {
        const save = vi.fn(() => Promise.resolve());
        let value: Values = { name: 'alpha' };

        const harness = await renderHook(() => useAutosave({
            value,
            save,
            delayMs: DELAY_MS,
            canSave: (input) => input.name !== ''
        }));

        value = { name: '' };
        await harness.render();
        await settle();

        expect(save).not.toHaveBeenCalled();
        expect(harness.current.state).toBe('pending');

        value = { name: 'gamma' };
        await harness.render();
        await settle();

        expect(save).toHaveBeenCalledExactlyOnceWith({ name: 'gamma' });
        expect(harness.current.state).toBe('saved');
    });

    it('flushes a pending write on unmount so navigating away keeps the edit', async () => {
        const save = vi.fn(() => Promise.resolve());
        let value: Values = { name: 'alpha' };

        const harness = await renderHook(() => useAutosave({ value, save, delayMs: 10_000 }));
        value = { name: 'delta' };
        await harness.render();
        expect(save).not.toHaveBeenCalled();

        await harness.unmount();
        await settle();

        expect(save).toHaveBeenCalledExactlyOnceWith({ name: 'delta' });
    });

    it('reports a rejected write and retries it on the next edit', async () => {
        const save = vi.fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValue(undefined);

        let value: Values = { name: 'alpha' };
        const harness = await renderHook(() => useAutosave({ value, save, delayMs: DELAY_MS }));

        value = { name: 'beta' };
        await harness.render();
        await settle();
        expect(harness.current.state).toBe('error');

        value = { name: 'beta ' };
        await harness.render();
        await settle();

        expect(save).toHaveBeenCalledTimes(2);
        expect(harness.current.state).toBe('saved');
    });

    it('stays inert when it is not enabled', async () => {
        const save = vi.fn(() => Promise.resolve());
        let value: Values = { name: 'alpha' };

        const harness = await renderHook(() => useAutosave({ value, save, enabled: false, delayMs: DELAY_MS }));
        value = { name: 'beta' };
        await harness.render();
        await settle();

        expect(save).not.toHaveBeenCalled();
        expect(harness.current.state).toBe('idle');
    });
});

describe('useForm autosave', () => {
    it('submits a field change without a save button', async () => {
        const onSubmit = vi.fn(() => Promise.resolve());
        const harness = await renderHook(() => useForm<Values>({
            validate,
            onSubmit,
            autosave: true,
            autosaveDelayMs: DELAY_MS,
            initialValues: { name: 'alpha' }
        }));

        expect(harness.current.autosave).toBe(true);

        await act(async () => {
            harness.current.field('name').onChange('beta');
        });
        await settle();

        expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ name: 'beta' });
        expect(harness.current.saveState).toBe('saved');
    });

    it('writes immediately on blur instead of waiting out the delay', async () => {
        const onSubmit = vi.fn(() => Promise.resolve());
        const harness = await renderHook(() => useForm<Values>({
            validate,
            onSubmit,
            autosave: true,
            autosaveDelayMs: 10_000,
            initialValues: { name: 'alpha' }
        }));

        await act(async () => {
            harness.current.field('name').onChange('beta');
        });
        expect(onSubmit).not.toHaveBeenCalled();

        await act(async () => {
            harness.current.field('name').onBlur();
        });
        await harness.flush();

        expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ name: 'beta' });
    });

    it('surfaces the field error and writes nothing while the value is invalid', async () => {
        const onSubmit = vi.fn(() => Promise.resolve());
        const harness = await renderHook(() => useForm<Values>({
            validate,
            onSubmit,
            autosave: true,
            autosaveDelayMs: DELAY_MS,
            initialValues: { name: 'alpha' }
        }));

        await act(async () => {
            harness.current.field('name').onChange('');
        });
        await settle();

        expect(onSubmit).not.toHaveBeenCalled();
        expect(harness.current.errors.name).toBe('Required');
        expect(harness.current.saveState).toBe('pending');
    });

    it('leaves a form without autosave on its submit path', async () => {
        const onSubmit = vi.fn(() => Promise.resolve());
        const harness = await renderHook(() => useForm<Values>({
            validate,
            onSubmit,
            initialValues: { name: 'alpha' }
        }));

        await act(async () => {
            harness.current.field('name').onChange('beta');
        });
        await settle();
        expect(onSubmit).not.toHaveBeenCalled();
        expect(harness.current.saveState).toBe('idle');

        await act(async () => {
            harness.current.handleSubmit();
        });
        await harness.flush();

        expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ name: 'beta' });
    });
});
