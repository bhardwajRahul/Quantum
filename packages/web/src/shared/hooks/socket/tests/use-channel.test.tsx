import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { useChannel } from '@/shared/hooks/socket/use-channel';
import { renderHook } from '@/shared/tests/render-hook';
import type { ChannelStatus } from '@/shared/contracts/channel';

const socket = vi.hoisted(() => {
    let status: ChannelStatus = 'connecting';
    const handlers = new Set<(s: ChannelStatus) => void>();

    return {
        subscribe(handler: (s: ChannelStatus) => void){
            handlers.add(handler);
            handler(status);
            return () => { handlers.delete(handler); };
        },
        emit(next: ChannelStatus){
            status = next;
            handlers.forEach((handler) => handler(next));
        },
        reset(){
            handlers.clear();
            status = 'connecting';
        }
    };
});

vi.mock('@/shared/services/socket/SocketChannel', () => ({
    default: class {
        onStatus(handler: (s: ChannelStatus) => void){ return socket.subscribe(handler); }
        onError(_handler: (message: string) => void){ return () => {}; }
        on(_type: string, _handler: (data: unknown) => void){ return () => {}; }
        send(_type: string, _data?: unknown){ return true; }
        close(){}
    }
}));

describe('useChannel', () => {
    beforeEach(() => {
        socket.reset();
    });

    it('returns the same object across renders until a status change', async () => {
        const harness = await renderHook(() => useChannel('/activity/stream', {}));
        const first = harness.current;
        expect(first.status).toBe('connecting');

        await harness.render();

        expect(harness.current).toBe(first);

        await act(async () => {
            socket.emit('open');
        });

        const afterOpen = harness.current;
        expect(afterOpen).not.toBe(first);
        expect(afterOpen.status).toBe('open');

        await harness.render();

        expect(harness.current).toBe(afterOpen);
        await harness.unmount();
    });

    it('reflects status transitions on the returned object', async () => {
        const harness = await renderHook(() => useChannel('/activity/stream', {}));

        await act(async () => { socket.emit('open'); });
        expect(harness.current.status).toBe('open');

        await act(async () => { socket.emit('reconnecting'); });
        expect(harness.current.status).toBe('reconnecting');

        await harness.unmount();
    });
});