import { Request } from 'express';
import { IUser } from '@typings/models/user';
import { ITenantContext } from '@typings/middlewares/tenancy';
import { RequestQueryString } from '@typings/utilities/apiFeatures';

export interface IRequest extends Request{
    user?: IUser;
    tenant?: ITenantContext;
    handlerData?: Record<string, any>;

    query: RequestQueryString;
}
