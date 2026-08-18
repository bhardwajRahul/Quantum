import RuntimeError from '@utilities/runtimeError';
import sendMail from '@services/sendEmail';
import { Request, Response, NextFunction } from 'express';

const parseError = (err: Error) => {
    const errorMap: { [key: string]: any } = {
        CastError: { message: 'Database::Cast::Error', statusCode: 400 },
        ValidationError: () => {
            const { errors } = err as any;
            const fields = Object.keys(errors);
            return {
                message: errors?.[fields?.[0]]?.message || 'Database::Validation::Error',

                statusCode: 400
            }
        },
        JsonWebTokenError: { message: 'JWT::Error', statusCode: 401 },
        TokenExpiredError: { message: 'JWT::Expired', statusCode: 401 },
        MongoServerError: (code: number) => {
            if(code === 11000) return { message: 'Database::Duplicated::Fields', statusCode: 400 };
            return { message: err.message, statusCode: (err as any).statusCode };
        }
    };
    const handler = errorMap[(err as any).name] || errorMap.MongoServerError;

    return typeof handler === 'function' ? handler((err as any).code) : handler;
};

const errorHandler = async (err: Error, req: Request, res: Response, next: NextFunction) => {
    (err as any).statusCode = (err as any).statusCode || 500;
    (err as any).message = err.message || 'Server Error';
    if(err instanceof RuntimeError){
        return res.status((err as any).statusCode).send({ status: 'error', message: err.message });
    }

    const { message, statusCode } = parseError(err);
    res.status(statusCode).send({ status: 'error', message });
};

export default errorHandler;