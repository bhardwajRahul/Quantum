import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import CreateCompose from '@/modules/template/pages/protected/Compose/Create';
import { templateInstallApi } from '@/modules/template/api/api';
import { useTenantStore } from '@/shared/store/tenant';
import { resetStores } from '@/shared/tests/store-reset';
import { respondWith } from '@/shared/tests/fetch-stub';
import { COMPOSE_STARTER } from '@/modules/template/utils/compose-starter';
import type { Root } from 'react-dom/client';
import type { Project } from '@quantum/contracts/modules/project/domain';

const navigate = vi.fn();

vi.mock('react-router-dom', () => ({
    useNavigate: () => navigate,
    Link: ({ children }: { children: unknown }) => children
}));

const PROJECT: Project = {
    id: 7, name: 'Shop', slug: 'shop', isDefault: true, organizationId: 3,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
};

let container: HTMLDivElement | undefined;
let root: Root | undefined;

const settle = async (rounds = 8) => {
    for(let i = 0; i < rounds; i += 1) await act(async () => undefined);
};

const render = async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root?.render(<CreateCompose />); });
    await settle();
};

const button = (label: string): HTMLButtonElement => {
    const found = [...(container?.querySelectorAll('button') ?? [])].find((node) => node.textContent?.includes(label));
    if(!found) throw new Error(`no ${label} button`);
    return found as HTMLButtonElement;
};

const typeName = async (value: string) => {
    const field = container?.querySelector('input');
    if(!field) throw new Error('no name input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
        field.focus();
        setter?.call(field, value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settle(3);
};

afterEach(async () => {
    await act(async () => { root?.unmount(); });
    container?.remove();
    navigate.mockReset();
    resetStores();
});

describe('deploy from compose', () => {
    const stub = () => {
        useTenantStore.getState().setOrganizationId(3);
        respondWith(200, { data: [PROJECT] });
    };

    it('starts from an example compose file and waits for a name before deploying', async () => {
        stub();
        await render();

        const editor = container?.querySelector('[data-monaco="yaml"]') as HTMLTextAreaElement | null;
        expect(editor?.value).toBe(COMPOSE_STARTER);
        expect(button('Deploy').disabled).toBe(true);

        await typeName('shop');
        expect(button('Deploy').disabled).toBe(false);
    });

    it('creates the stack in the picked project and returns to Applications', async () => {
        stub();
        const create = vi.spyOn(templateInstallApi, 'createCompose').mockResolvedValue({ id: 11 } as never);
        await render();
        await typeName('shop');

        await act(async () => { button('Deploy').click(); });
        await settle();

        expect(create).toHaveBeenCalledWith({ path: { projectId: 7 }, body: { name: 'shop', compose: COMPOSE_STARTER } });
        expect(navigate).toHaveBeenCalledWith('/applications?project=7');
    });
});
