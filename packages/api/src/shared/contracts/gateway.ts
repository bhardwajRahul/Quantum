import type { WebSocket } from '@fastify/websocket';

export type GatewaySocket = WebSocket;

/**
 * A frame names its type and carries its payload under `data`, in both directions.
 * They used to disagree: the server answered with `{type, data}` while the client sent
 * `{type, ...payload}`, so a handler reading `data` got `undefined` and rejected the
 * frame — and one that read the payload's own fields only worked by accident of the
 * spread.
 */
export interface InboundFrame{
    type: string;
    data?: unknown;
}

export interface OutboundMessage<T>{
    type: string;
    data: T;
}

export type GatewayLifecycle = 'connect' | 'disconnect';

interface MessageHandler{
    kind: 'message';
    type: string;
    handlerName: string | symbol;
}

interface LifecycleHandler{
    kind: GatewayLifecycle;
    handlerName: string | symbol;
}

export type GatewayHandler = MessageHandler | LifecycleHandler;
