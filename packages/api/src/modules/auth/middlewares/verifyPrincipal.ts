import { AuthError } from '../contracts/domain/errors';
import JWTService from '../services/JWTService';
import User from '@/modules/user/models/User';

export const verifyPrincipal = async (token: string): Promise<number> => {
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

    return user.id;
};
