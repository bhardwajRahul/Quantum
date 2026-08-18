import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

const { updateOne, findById, userUpdateOne, imageUpdateOne, networkUpdateOne } = vi.hoisted(() => ({
    updateOne: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
    userUpdateOne: vi.fn().mockResolvedValue(undefined),
    imageUpdateOne: vi.fn().mockResolvedValue(undefined),
    networkUpdateOne: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@models/docker/image', () => ({ default: { updateOne: imageUpdateOne } }));
vi.mock('@models/docker/network', () => ({ default: { updateOne: networkUpdateOne, findById: vi.fn() } }));

const modelSpy = vi.spyOn(mongoose, 'model').mockImplementation(((name: string) => {
    if(name === 'DockerContainer') return { findById, updateOne } as any;
    if(name === 'User') return { updateOne: userUpdateOne } as any;
    return {} as any;
}) as any);

import DockerContainerService, { materializeContainer } from '@services/docker/container';

describe('materializeContainer (ADR-0001 seam)', () => {
    let createAndStart: any;
    let getIp: any;

    beforeEach(() => {
        updateOne.mockClear();
        findById.mockReset();
        userUpdateOne.mockClear();
        imageUpdateOne.mockClear();
        networkUpdateOne.mockClear();

        createAndStart = vi.spyOn(DockerContainerService.prototype, 'createAndStartContainer')
            .mockResolvedValue(null as any);
        getIp = vi.spyOn(DockerContainerService.prototype, 'getIpAddress')
            .mockResolvedValue('172.18.0.5');
    });

    it('re-loads the doc (decrypt), creates+starts, persists ipAddress, writes 3 back-refs', async () => {
        const userId = new mongoose.Types.ObjectId();
        const imageId = new mongoose.Types.ObjectId();
        const networkId = new mongoose.Types.ObjectId();
        const containerId = new mongoose.Types.ObjectId();

        const fresh = {
            _id: containerId,
            user: userId,
            image: imageId,
            network: networkId,
            environment: { isEncrypted: false, variables: new Map([['SECRET', 'plain-value']]) }
        };
        findById.mockResolvedValue(fresh);

        await materializeContainer({ _id: containerId } as any);

        expect(findById).toHaveBeenCalledWith(containerId);

        expect(createAndStart).toHaveBeenCalledTimes(1);
        expect(getIp).toHaveBeenCalledTimes(1);

        expect(updateOne).toHaveBeenCalledWith({ _id: containerId }, { ipAddress: '172.18.0.5' });

        expect(userUpdateOne).toHaveBeenCalledWith({ _id: userId }, { $push: { containers: containerId } });
        expect(imageUpdateOne).toHaveBeenCalledWith({ _id: imageId }, { $push: { containers: containerId } });
        expect(networkUpdateOne).toHaveBeenCalledWith({ _id: networkId }, { $push: { containers: containerId } });
    });

    it('the daemon path sees PLAINTEXT env (the encryption-ordering trap)', async () => {
        const containerId = new mongoose.Types.ObjectId();
        const fresh = {
            _id: containerId,
            user: new mongoose.Types.ObjectId(),
            image: new mongoose.Types.ObjectId(),
            network: new mongoose.Types.ObjectId(),
            environment: { isEncrypted: false, variables: new Map([['PASSWORD', 'hunter2']]) }
        };
        findById.mockResolvedValue(fresh);

        let seenEnv: any;
        createAndStart.mockImplementation(async function(this: any){
            seenEnv = this.container?.environment;
            return null;
        });
        await materializeContainer({ _id: containerId } as any);
        expect(seenEnv?.isEncrypted).toBe(false);
        expect(seenEnv?.variables?.get('PASSWORD')).toBe('hunter2');
    });

    it('skips work (no throw) if the doc vanished before materialize', async () => {
        findById.mockResolvedValue(null);
        await expect(materializeContainer({ _id: new mongoose.Types.ObjectId() } as any)).resolves.toBeUndefined();
        expect(createAndStart).not.toHaveBeenCalled();
        expect(updateOne).not.toHaveBeenCalled();
    });
});
