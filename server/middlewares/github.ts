import passport from 'passport';
import RuntimeError from '@utilities/runtimeError';
import { Request, Response, NextFunction } from 'express';
import { IUser } from '@typings/models/user';

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
    if(!req.query.userId){
        return next(new RuntimeError('Github::Missing::UserId',400));
    }
    const userId = req.query.userId as string;
    req.session.userId = userId;
    passport.authenticate('github' ,{ scope: ['user', 'repo'] })(req, res, next);
};

export const populateGithubAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if(!req.user){
        throw new Error('Authentication middleware chain error: Missing user');
    }
    req.user = await (req.user as IUser).populate('github');
    next();
};

export const populateRepositories = async (req: Request, res: Response,next: NextFunction): Promise<void> => {
    if(!req.user){
        throw new Error('Authentication middleware chain error: Missing user');
    }
    req.user = await (req.user as IUser).populate('repositories');
    next();
};

export const authenticateCallback = passport.authenticate('github',{ failureRedirect:'/' });
