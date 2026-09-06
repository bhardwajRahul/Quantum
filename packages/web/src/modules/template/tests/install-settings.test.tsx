import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import InstallSettings from '@/modules/template/pages/protected/Installs/[installId]/Settings';
import { templateInstallApi } from '@/modules/template/api/api';
import { resetStores } from '@/shared/tests/store-reset';
import type { Root } from 'react-dom/client';

vi.mock('react-router-dom', () => ({
    useParams: () => ({ installId: '4' })
}));

const URL_BEFORE = 'https://api.quantum.test/template/install/4/deploy/tok-one';
const URL_AFTER = 'https://api.quantum.test/template/install/4/deploy/tok-two';

let container: HTMLDivElement | undefined;
let root: Root | undefined;

const settle = async (rounds = 8) => {
    for(let i = 0; i < rounds; i += 1) await act(async () => undefined);
};

const button = (label: string): HTMLButtonElement => {
    const found = [...(container?.querySelectorAll('button') ?? [])].find((node) => node.textContent?.includes(label));
    if(!found) throw new Error(`no ${label} button`);
    return found as HTMLButtonElement;
};

afterEach(async () => {
    await act(async () => { root?.unmount(); });
    container?.remove();
    resetStores();
});

describe('install settings', () => {
    it('shows the webhook url and rotates it on request', async () => {
        vi.spyOn(templateInstallApi, 'triggers')
            .mockResolvedValueOnce({ webhookUrl: URL_BEFORE, watchImages: false })
            .mockResolvedValueOnce({ webhookUrl: URL_AFTER, watchImages: false });
        const rotate = vi.spyOn(templateInstallApi, 'rotateDeployToken').mockResolvedValue({ webhookUrl: URL_AFTER, watchImages: false });

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => { root?.render(<InstallSettings />); });
        await settle();

        expect(container.textContent).toContain(URL_BEFORE);
        expect(container.querySelector('[role="switch"]')).not.toBeNull();

        await act(async () => { button('Rotate').click(); });
        await settle();

        expect(rotate).toHaveBeenCalledWith({ path: { id: 4 } });
        expect(container.textContent).toContain(URL_AFTER);
    });
});
