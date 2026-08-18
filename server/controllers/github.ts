import { catchAsync, filterObject } from '@utilities/helpers';
import Github from '@models/github';
import HandlerFactory from '@controllers/common/handlerFactory';
import { resolveCreateScope } from '@middlewares/tenancy';
import RuntimeError from '@utilities/runtimeError';
import { IRequest } from '@typings/controllers/common';
import { Request, Response, NextFunction } from 'express';

const GithubFactory = new HandlerFactory({
    model: Github,
    scope: { field: 'user' },
    fields: [
        'user',
        'githubId',
        'username',
        'avatarUrl'
    ]
});

export const getAccounts = GithubFactory.getAll();
export const getAccount = GithubFactory.getOne();

export const createAccount = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const accessToken = req.body.accessToken;
    if(!accessToken){
        return next(new RuntimeError('Github::AccessToken::Required', 400));
    }
    const record = await Github.create({
        ...filterObject(req.body, 'githubId', 'username', 'avatarUrl'),
        ...resolveCreateScope(req, 'user'),
        accessToken
    });
    res.status(201).json({ status: 'success', data: record });
});

export const updateAccount = GithubFactory.updateOne();
export const deleteAccount = GithubFactory.deleteOne();

export const authCallback = catchAsync(async (req: Request, res: Response) => {
    const { accessToken, profile } = req.user as any;
    const { id, username, _json } = profile;
    const { avatar_url } = _json;
    const data = { id, username, avatar_url };

    res.writeHead(302, {
        'Location': `${process.env.CLIENT_HOST}/github/authenticate/?accessToken=${accessToken}&data=${JSON.stringify(data)}`
    });
    res.end();
});