import type { FastifyRequest } from 'fastify';
import type { GatewaySocket, InboundFrame } from '@/shared/contracts/gateway';

export const SOCKET = Symbol('gateway.socket');
export const PAYLOAD = Symbol('gateway.payload');

export interface GatewayContext extends FastifyRequest{
    [SOCKET]: GatewaySocket;
    [PAYLOAD]: unknown;
}

export const createContext = (
    req: FastifyRequest,
    socket: GatewaySocket,
    frame: InboundFrame | undefined
): GatewayContext => {
    const ctx = Object.create(req) as GatewayContext;
    ctx[SOCKET] = socket;
    ctx[PAYLOAD] = frame?.data;
    return ctx;
};
