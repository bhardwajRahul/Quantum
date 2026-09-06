import { MiddlewareFn } from '@/shared/middlewares/Middleware';
import { AuthError } from '../contracts/domain/errors';
import { verifyPrincipal } from './verifyPrincipal';

export const AuthenticatedRoute: MiddlewareFn = async (req) => {
    const header = req.headers.authorization;
    if(!header?.startsWith('Bearer ')){
        throw AuthError.Unauthorized();
    }

    req.principal = { userId: await verifyPrincipal(header.slice('Bearer '.length).trim()) };
};
