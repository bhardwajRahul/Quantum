import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import InlineEdit from '@/shared/components/InlineEdit';
import type { Root } from 'react-dom/client';

let container: HTMLDivElement | undefined;
let root: Root | undefined;

const render = async (onCommit: (value: string) => unknown) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root?.render(<InlineEdit value='word' ariaLabel='Name' onCommit={onCommit} />); });
    return container.querySelector('[role="textbox"]') as HTMLElement;
};

const key = async (node: HTMLElement, name: string) => {
    await act(async () => { node.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true })); });
};

afterEach(async () => {
    await act(async () => { root?.unmount(); });
    container?.remove();
});

describe('InlineEdit', () => {
    it('becomes editable on click and commits the trimmed text on Enter', async () => {
        const onCommit = vi.fn();
        const node = await render(onCommit);
        expect(node.getAttribute('contenteditable')).toBe('false');

        await act(async () => { node.click(); });
        expect(node.getAttribute('contenteditable')).toBe('plaintext-only');

        node.textContent = '  wordpress  ';
        await key(node, 'Enter');

        expect(onCommit).toHaveBeenCalledWith('wordpress');
        expect(node.getAttribute('contenteditable')).toBe('false');
    });

    it('restores the name on Escape and ignores an unchanged or empty name', async () => {
        const onCommit = vi.fn();
        const node = await render(onCommit);

        await act(async () => { node.click(); });
        node.textContent = 'something else';
        await key(node, 'Escape');
        expect(node.textContent).toBe('word');
        expect(onCommit).not.toHaveBeenCalled();

        await act(async () => { node.click(); });
        node.textContent = '   ';
        await key(node, 'Enter');
        expect(node.textContent).toBe('word');
        expect(onCommit).not.toHaveBeenCalled();
    });
});
