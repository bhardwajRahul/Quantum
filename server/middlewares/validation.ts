import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import RuntimeError from '@utilities/runtimeError';

export type ValidationTarget = 'body' | 'query' | 'params';

export const validate = (schema: ZodSchema, target: ValidationTarget = 'body') => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const result = schema.safeParse((req as any)[target]);
        if(!result.success){
            return next(new RuntimeError(formatZodError(result.error), 400));
        }

        try{
            (req as any)[target] = result.data;
        }catch{
            Object.assign((req as any)[target], result.data);
        }
        next();
    };
};

const formatZodError = (error: ZodError): string => {
    const first = error.errors[0];
    const path = first?.path?.join('.') || 'payload';
    return `Validation::${path}: ${first?.message || 'Invalid input'}`;
};

export default validate;
