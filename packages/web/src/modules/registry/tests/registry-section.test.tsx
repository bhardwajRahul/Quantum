import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { invalidateCache } from 'alova';
import { createRoot } from 'react-dom/client';
import RegistrySection from '@/modules/registry/components/RegistrySection';
import { resetStores } from '@/shared/tests/store-reset';
import { respondWith } from '@/shared/tests/fetch-stub';
import type { Root } from 'react-dom/client';
import type { RegistryCredential } from '@quantum/contracts/modules/registry/domain';

const credential = (id: number, registry: string, username: string): RegistryCredential => ({
    id, registry, username, organizationId: 3,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
});

let container: HTMLDivElement | undefined;
let root: Root | undefined;

const render = async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root?.render(<RegistrySection organizationId={3} />); });
    for(let i = 0; i < 8; i += 1) await act(async () => undefined);
};

afterEach(async () => {
    await act(async () => { root?.unmount(); });
    container?.remove();
    await invalidateCache();
    resetStores();
});

describe('registry credentials section', () => {
    it('lists one row per registry with its username and offers to add more', async () => {
        respondWith(200, { data: [credential(1, 'ghcr.io', 'octocat'), credential(2, 'docker.io', 'hubber')] });
        await render();

        expect(container?.textContent).toContain('ghcr.io');
        expect(container?.textContent).toContain('octocat');
        expect(container?.textContent).toContain('docker.io');
        expect(container?.querySelector('[aria-label="Remove credentials for ghcr.io"]')).not.toBeNull();
        expect([...(container?.querySelectorAll('button') ?? [])].some((node) => node.textContent?.includes('Add registry'))).toBe(true);
    });

    it('explains that public images need nothing when the list is empty', async () => {
        respondWith(200, { data: [] });
        await render();

        expect(container?.textContent).toContain('Public images need none');
    });
});
