import { Model } from 'mongoose';
import { IRequest } from '@typings/controllers/common';
import { Response } from 'express';

export interface ScopeConfig{
    field: string;
    public?: boolean;
}

export interface HandlerFactoryOptions{
    model: Model<any>;
    fields?: string[];
    scope?: ScopeConfig | false;
}

export type MiddlewareFunction = (req: IRequest, data: any) => Promise<any>;

export interface HandlerFactoryMiddleware{
    pre?: MiddlewareFunction[];
    post?: MiddlewareFunction[];
}

export interface HandlerFactoryMethodConfig{
    middlewares?: HandlerFactoryMiddleware;
    responseInterceptor?: (req: IRequest, res: Response, body: any) => Promise<any>;
    scope?: ScopeConfig | false;
}