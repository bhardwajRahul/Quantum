import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useApp } from '@tests/harness';
import { seed } from '@tests/Seed';
import { allocateHostPort } from '@/modules/deployment/orchestrator/PortAllocator';
import { getDockerHost } from '@/modules/deployment/orchestrator/DockerHost';
import PortBinding from '@/modules/codespace/models/PortBinding';
import { PortBindingProtocol } from '@quantum/contracts/modules/codespace/domain';

useApp();

const listContainers = vi.fn();

beforeEach(() => {
    listContainers.mockReset().mockResolvedValue([]);
    vi.spyOn(getDockerHost(), 'listContainers').mockImplementation(listContainers as never);
});

const binding = async (externalPort: number) => {
    const { user, org } = await seed.orgContext();
    return PortBinding.create({
        containerId: externalPort,
        userId: user.id,
        organizationId: org.id,
        internalPort: 3000,
        externalPort,
        protocol: PortBindingProtocol.Tcp
    }).save();
};

describe('allocateHostPort', () => {
    it('starts at the bottom of the range when nothing is taken', async () => {
        await expect(allocateHostPort()).resolves.toBe(20_000);
    });

    it('skips a port this platform already handed out', async () => {
        await binding(20_000);

        await expect(allocateHostPort()).resolves.toBe(20_001);
    });

    /**
     * The table alone is not enough: something else on the box may hold the port, and
     * Docker would only report that as a bind failure once the container is created.
     */
    it('skips a port another container on the host is publishing', async () => {
        listContainers.mockResolvedValue([{ Ports: [{ PublicPort: 20_000 }, { PublicPort: 20_001 }] }]);

        await expect(allocateHostPort()).resolves.toBe(20_002);
    });

    it('still allocates when Docker cannot be reached', async () => {
        listContainers.mockRejectedValue(new Error('daemon unreachable'));
        await binding(20_000);

        await expect(allocateHostPort()).resolves.toBe(20_001);
    });
});
