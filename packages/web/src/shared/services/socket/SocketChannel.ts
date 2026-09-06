import { env } from '@/shared/config/env';
import { useSessionStore } from '@/shared/store/session';
import type { ChannelStatus, ErrorHandler, MessageHandler, OutboundFrame, StatusHandler } from '@/shared/contracts/channel';

const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 10_000;

const toWebSocketBase = (httpUrl: string): string => httpUrl.replace(/^http/, 'ws');

const wsUrl = (path: string): string => {
    const base = toWebSocketBase(env.apiUrl).replace(/\/+$/, '');
    const suffix = path.startsWith('/') ? path : `/${path}`;
    return `${base}${suffix}`;
};

export default class SocketChannel{
    readonly #path: string;
    #socket: WebSocket | null = null;
    #status: ChannelStatus = 'connecting';
    #attempts = 0;
    #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    #released = false;

    readonly #listeners = new Map<string, Set<MessageHandler<unknown>>>();
    readonly #statusHandlers = new Set<StatusHandler>();
    readonly #errorHandlers = new Set<ErrorHandler>();

    constructor(path: string){
        this.#path = path;
        this.#bindNetworkRecovery();
        this.#connect();
    }

    get status(): ChannelStatus{
        return this.#status;
    }

    send(type: string, data?: unknown): boolean{
        if(this.#socket?.readyState !== WebSocket.OPEN) return false;
        this.#socket.send(JSON.stringify({ type, data }));
        return true;
    }

    on(type: string, handler: MessageHandler<unknown>): () => void{
        const handlers = this.#listeners.get(type) ?? new Set<MessageHandler<unknown>>();
        handlers.add(handler);
        this.#listeners.set(type, handlers);
        return () => {
            handlers.delete(handler);
            if(handlers.size === 0) this.#listeners.delete(type);
        };
    }

    onStatus(handler: StatusHandler): () => void{
        this.#statusHandlers.add(handler);
        handler(this.#status);
        return () => { this.#statusHandlers.delete(handler); };
    }

    onError(handler: ErrorHandler): () => void{
        this.#errorHandlers.add(handler);
        return () => { this.#errorHandlers.delete(handler); };
    }

    close(){
        this.#released = true;
        this.#clearReconnect();
        this.#unbindNetworkRecovery();
        this.#setStatus('closed');
        this.#socket?.close();
        this.#socket = null;
    }

    #connect(){
        if(this.#released) return;
        this.#clearReconnect();
        this.#setStatus(this.#attempts === 0 ? 'connecting' : 'reconnecting');

        const url = wsUrl(this.#path);
        const token = useSessionStore.getState().token;
        const socket = token ? new WebSocket(url, token) : new WebSocket(url);
        this.#socket = socket;

        socket.onopen = () => {
            this.#attempts = 0;
            this.#setStatus('open');
        };
        socket.onmessage = (event) => this.#dispatch(event.data);
        socket.onclose = () => this.#onClose();
    }

    #onClose(){
        this.#socket = null;
        if(this.#released) return;
        this.#scheduleReconnect();
    }

    #scheduleReconnect(){
        this.#setStatus('reconnecting');
        const delay = this.#backoffDelay();
        this.#attempts += 1;
        this.#reconnectTimer = setTimeout(() => this.#connect(), delay);
    }

    #backoffDelay(): number{
        const ceiling = Math.min(MAX_BACKOFF_MS, INITIAL_BACKOFF_MS * 2 ** this.#attempts);
        return ceiling / 2 + Math.random() * (ceiling / 2);
    }

    #clearReconnect(){
        if(this.#reconnectTimer === null) return;
        clearTimeout(this.#reconnectTimer);
        this.#reconnectTimer = null;
    }

    #dispatch(raw: unknown){
        if(typeof raw !== 'string') return;

        let frame: OutboundFrame;
        try{
            frame = JSON.parse(raw) as OutboundFrame;
        }catch{
            return;
        }

        if(typeof frame.error === 'string'){
            this.#errorHandlers.forEach((handler) => handler(frame.error as string));
            return;
        }
        if(typeof frame.type === 'string'){
            this.#listeners.get(frame.type)?.forEach((handler) => handler(frame.data));
        }
    }

    #setStatus(status: ChannelStatus){
        if(status === this.#status) return;
        this.#status = status;
        this.#statusHandlers.forEach((handler) => handler(status));
    }

    #bindNetworkRecovery(){
        if(typeof window !== 'undefined') window.addEventListener('online', this.#recover);
        if(typeof document !== 'undefined') document.addEventListener('visibilitychange', this.#onVisibility);
    }

    #unbindNetworkRecovery(){
        if(typeof window !== 'undefined') window.removeEventListener('online', this.#recover);
        if(typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.#onVisibility);
    }

    #onVisibility = () => {
        if(document.visibilityState === 'visible') this.#recover();
    };

    #recover = () => {
        if(this.#released) return;
        const state = this.#socket?.readyState;
        if(state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;
        this.#attempts = 0;
        this.#connect();
    };
}
