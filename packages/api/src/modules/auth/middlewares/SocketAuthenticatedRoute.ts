import { MiddlewareFn } from '@/shared/middlewares/Middleware';
import { AuthError } from '../contracts/domain/errors';
import { verifyPrincipal } from './verifyPrincipal';

const tokenFromSubprotocol = (header: string | undefined): string | undefined => {
    const token = header?.split(',')[0]?.trim();
    return token || undefined;
};

const tokenFromQuery = (query: unknown): string | undefined => {
    const token = (query as { token?: string }).token?.trim();
    return token || undefined;
};

export const SocketAuthenticatedRoute: MiddlewareFn = async (req) => {
    const token = tokenFromSubprotocol(req.headers['sec-websocket-protocol']) ?? tokenFromQuery(req.query);
    if(!token) throw AuthError.Unauthorized();

    req.principal = { userId: await verifyPrincipal(token) };
};
