import { MiddlewareFn } from '@/shared/middlewares/Middleware';
import { AuthError } from '../contracts/domain/errors';
import JWTService from '../services/JWTService';
import User from '@/modules/user/models/User';

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

    let sub: string;
    let iatMs: number;
    try{
        ({ sub, iatMs } = new JWTService().verify(token));
    }catch{
        throw AuthError.InvalidToken();
    }

    const user = await User.findOneBy({ id: Number(sub) });
    if(!user) throw AuthError.InvalidToken();
    if(user.passwordChangedAt && iatMs < user.passwordChangedAt.getTime()){
        throw AuthError.InvalidToken();
    }

    req.principal = { userId: user.id };
};
