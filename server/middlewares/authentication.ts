import jwt from 'jsonwebtoken';
import User from '@models/user';
import RuntimeError from '@utilities/runtimeError';
import { IDecodedToken } from '@typings/middlewares/authentication';
import { IUser } from '@typings/models/user';
import { catchAsync, deleteJWTCookie } from '@utilities/helpers';
import { Request, Response, NextFunction } from 'express';
import logger from '@utilities/logger';

export const getUserByToken = async (token: string, res: Response | undefined = undefined): Promise<IUser> => {
    if(!process.env.SECRET_KEY){
        logger.error('@middlewares/authentication.ts (getUserByToken): process.env.SECRET_KEY is empty!');
        throw new RuntimeError('Authentication::SecretKey::Empty', 500);
    }
    const decodedToken = jwt.verify(token, process.env.SECRET_KEY) as IDecodedToken;

    const freshUser = await User.findById(decodedToken.id);
    if(!freshUser){
        if(res) deleteJWTCookie(res);
        throw new RuntimeError('Authentication::User::NotFound', 401);
    }

    if(freshUser.isPasswordChangedAfterJWFWasIssued(decodedToken.iat)){
        if(res) deleteJWTCookie(res);
        throw new RuntimeError('Authentication::PasswordChanged', 401);
    }
    return freshUser;
};

export const protect = catchAsync(async (req: Request, res: Response | undefined, next: NextFunction) => {

    let token: string | undefined = req.cookies.jwt;
    if(!token){
        return next(new RuntimeError('Authentication::Required', 401));
    }

    const freshUser = await getUserByToken(token, res);

    req.user = freshUser;
    next();
});

export const restrictTo = (...roles:string[]):((req: Request, res: Response, next: NextFunction) => void) => {
    return (req: Request, res: Response, next: NextFunction) => {

        if(!roles.includes((req.user as IUser).role)){
            return next(new RuntimeError('Authentication::Unauthorized',403));
        }
        next();
    };
};
