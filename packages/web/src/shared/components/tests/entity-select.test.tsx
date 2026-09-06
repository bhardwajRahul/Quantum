import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import EntitySelect from '@/shared/components/EntitySelect';
import type { ReactElement } from 'react';
import type { Root } from 'react-dom/client';

interface Item{
    id: string;
    label: string;
}

const ITEMS: Item[] = [
    { id: 'node', label: 'Node.js' },
    { id: 'python', label: 'Python' }
];

let container: HTMLDivElement | undefined;
let root: Root | undefined;

const render = async (element: ReactElement) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root?.render(element); });
};

const triggerText = (): string => container?.querySelector('[data-slot="select-value"]')?.textContent ?? '';

afterEach(async () => {
    await act(async () => { root?.unmount(); });
    container?.remove();
    container = undefined;
    root = undefined;
});

describe('EntitySelect', () => {
    const select = (value: string | null) => (
        <EntitySelect
            items={ITEMS}
            getKey={(item) => item.id}
            getLabel={(item) => item.label}
            value={value}
            onChange={() => undefined}
            placeholder='Select a runtime'
            ariaLabel='Runtime'
        />
    );

    it('shows the placeholder while nothing is selected', async () => {
        await render(select(null));

        expect(triggerText()).toBe('Select a runtime');
    });

    it('shows the selected label, not the placeholder, once a value is set', async () => {
        await render(select('python'));

        expect(triggerText()).toBe('Python');
        expect(triggerText()).not.toBe('Select a runtime');
    });
});
