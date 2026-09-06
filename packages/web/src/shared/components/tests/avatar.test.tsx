import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import Avatar from '@/shared/components/Avatar';
import type { Root } from 'react-dom/client';

let container: HTMLDivElement | undefined;
let root: Root | undefined;

const render = async (fullname: string) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root?.render(<Avatar fullname={fullname} />); });
    return container.textContent ?? '';
};

afterEach(async () => {
    await act(async () => { root?.unmount(); });
    container?.remove();
});

describe('Avatar', () => {
    it('takes the first and last initial', async () => {
        expect(await render('Rody Herrera')).toBe('RH');
    });

    it('uses the single initial of a one-word name', async () => {
        expect(await render('Rody')).toBe('R');
    });

    it('skips the middle of a longer name', async () => {
        expect(await render('Ada Byron King Lovelace')).toBe('AL');
    });

    it('survives extra whitespace instead of rendering a blank badge', async () => {
        expect(await render('   Grace   Hopper  ')).toBe('GH');
    });

    it('shows a placeholder rather than nothing when the name is empty', async () => {
        expect(await render('')).toBe('?');
    });
});
