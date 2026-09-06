import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import InternalAddress from '@/shared/components/InternalAddress';
import type { Root } from 'react-dom/client';
import type { ContainerAddress } from '@quantum/contracts/modules/docker/domain';

let container: HTMLDivElement | undefined;
let root: Root | undefined;

const render = async (address: ContainerAddress | null) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root?.render(<InternalAddress address={address} />); });
};

afterEach(async () => {
    await act(async () => { root?.unmount(); });
    container?.remove();
});

describe('internal address', () => {
    it('shows the ip with a copy control', async () => {
        await render({ ip: '10.42.0.7', hostname: 'shop-api' });

        expect(container?.querySelector('code')?.textContent).toBe('10.42.0.7');
        expect(container?.textContent).not.toContain('shop-api');
        expect(container?.querySelector('button')?.getAttribute('aria-label')).toBe('Copy 10.42.0.7');
    });

    it('falls back to a dash while the container has no address', async () => {
        await render({ ip: null, hostname: 'shop-api' });
        expect(container?.textContent).toBe('—');

        await act(async () => { root?.unmount(); });
        await render(null);
        expect(container?.textContent).toBe('—');
    });
});
