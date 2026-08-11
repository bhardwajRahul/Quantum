import { MiddlewareFn } from '@/shared/middlewares/Middleware';
import { AuthError } from '../contracts/domain/errors';
import JWTService from '../services/JWTService';
import User from '@/modules/user/models/User';

export const AuthenticatedRoute: MiddlewareFn = async (req) => {
    const header = req.headers.authorization;
    if(!header?.startsWith('Bearer ')){
        throw AuthError.Unauthorized();
    }

    let sub: string;
    let iatMs: number;
    try{
        ({ sub, iatMs } = new JWTService().verify(header.slice('Bearer '.length).trim()));
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
