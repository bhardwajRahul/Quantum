import { describe, it, expect, vi } from 'vitest';
import errorHandler from '@controllers/common/globalErrorHandler';
import RuntimeError from '@utilities/runtimeError';

const mockRes = () => {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.send = vi.fn().mockReturnValue(res);
    return res;
};

const run = async (err: any) => {
    const res = mockRes();
    await errorHandler(err, {} as any, res, (() => {}) as any);
    return { code: res.status.mock.calls[0]?.[0], body: res.send.mock.calls[0]?.[0] };
};

describe('globalErrorHandler status mapping', () => {
    it('maps a Mongoose ValidationError to 400 (not 401)', async () => {
        const err: any = new Error('validation');
        err.name = 'ValidationError';
        err.errors = { externalPort: { message: 'PortBinding::ExternalPort::Required' } };
        const { code, body } = await run(err);
        expect(code).toBe(400);
        expect(body.message).toBe('PortBinding::ExternalPort::Required');
    });

    it('maps a CastError to 400', async () => {
        const err: any = new Error('cast'); err.name = 'CastError';
        expect((await run(err)).code).toBe(400);
    });

    it('maps a duplicate-key MongoServerError (11000) to 400', async () => {
        const err: any = new Error('dup'); err.name = 'MongoServerError'; err.code = 11000;
        const { code, body } = await run(err);
        expect(code).toBe(400);
        expect(body.message).toBe('Database::Duplicated::Fields');
    });

    it('passes a RuntimeError through with its own status code', async () => {
        const { code, body } = await run(new RuntimeError('Github::Account::NotLinked', 400));
        expect(code).toBe(400);
        expect(body.message).toBe('Github::Account::NotLinked');
    });

    it('still maps JWT errors to 401', async () => {
        const err: any = new Error('jwt'); err.name = 'JsonWebTokenError';
        expect((await run(err)).code).toBe(401);
    });
});
