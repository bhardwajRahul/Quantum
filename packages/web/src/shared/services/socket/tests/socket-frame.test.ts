import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SocketChannel from '@/shared/services/socket/SocketChannel';

const sent: string[] = [];
let instance: FakeSocket | undefined;

class FakeSocket{
    static readonly OPEN = 1;
    readyState = 1;
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;

    constructor(){
        FakeSocket.track(this);
    }

    static track(socket: FakeSocket){ instance = socket; }

    send(raw: string){ sent.push(raw); }
    close(){ this.readyState = 3; }
}

beforeEach(() => {
    sent.length = 0;
    instance = undefined;
    vi.stubGlobal('WebSocket', FakeSocket);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const frames = () => sent.map((raw) => JSON.parse(raw) as { type: string; data?: unknown });

describe('SocketChannel frames', () => {
    /**
     * The envelope has to be the same one the server answers with. It used to spread the
     * payload into the frame instead — `{type, ...data}` — so a handler reading `data`
     * saw `undefined` and rejected the frame as malformed. That is what broke the shell:
     * every keystroke went out as `{"0":"l","1":"s"}`.
     */
    it('nests the payload under data, matching the inbound envelope', () => {
        const channel = new SocketChannel('/repository/2/terminal');
        instance?.onopen?.();

        channel.send('terminal.resize', { cols: 120, rows: 40 });

        expect(frames()).toEqual([{ type: 'terminal.resize', data: { cols: 120, rows: 40 } }]);
    });

    it('carries a bare string payload through intact', () => {
        const channel = new SocketChannel('/repository/2/terminal');
        instance?.onopen?.();

        channel.send('terminal.input', 'ls -la\r');

        expect(frames()).toEqual([{ type: 'terminal.input', data: 'ls -la\r' }]);
    });

    it('sends a type with no payload for handlers that take none', () => {
        const channel = new SocketChannel('/resource/stream');
        instance?.onopen?.();

        channel.send('subscribe');

        expect(frames()).toEqual([{ type: 'subscribe' }]);
    });

    it('reads an inbound payload from the same place it writes one', () => {
        const channel = new SocketChannel('/repository/2/terminal');
        instance?.onopen?.();

        const seen: unknown[] = [];
        channel.on('terminal.output', (data) => seen.push(data));
        instance?.onmessage?.({ data: JSON.stringify({ type: 'terminal.output', data: 'hello' }) });

        expect(seen).toEqual(['hello']);
    });
});
