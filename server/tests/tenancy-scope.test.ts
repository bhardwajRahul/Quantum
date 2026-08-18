import { describe, it, expect, beforeAll } from 'vitest';
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import HandlerFactory from '@controllers/common/handlerFactory';
import { setupMemoryMongo } from '@tests/helpers/memoryMongo';
import RuntimeError from '@utilities/runtimeError';

setupMemoryMongo();

const WidgetSchema = new mongoose.Schema({
    name: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});
let Widget: any;
let factory: HandlerFactory;
let app: express.Express;

const USER_A = new mongoose.Types.ObjectId();
const USER_B = new mongoose.Types.ObjectId();

beforeAll(() => {
    Widget = mongoose.model('Widget', WidgetSchema);
    factory = new HandlerFactory({ model: Widget, fields: ['name', 'user'], scope: { field: 'user' } });

    app = express();
    app.use(express.json());

    app.use((req: any, _res, next) => {
        const who = req.query.as === 'B' ? USER_B : USER_A;
        req.user = { _id: who, role: 'user' };
        req.tenant = { role: 'member', orgIds: [], projectIds: [], isPlatformAdmin: false };
        next();
    });
    app.get('/widgets', factory.getAll());
    app.get('/widgets/:id', factory.getOne());
    app.post('/widgets', factory.createOne());
    app.patch('/widgets/:id', factory.updateOne());
    app.delete('/widgets/:id', factory.deleteOne());

    app.use((err: any, _req: any, res: any, _next: any) => {
        const code = err instanceof RuntimeError ? err.statusCode : 500;
        res.status(code).json({ status: 'error', message: err.message });
    });
});

const makeWidget = (user: mongoose.Types.ObjectId, name: string) => Widget.create({ user, name });

describe('HandlerFactory tenant isolation', () => {
    it('createOne stamps the acting user (cannot spoof owner via body)', async () => {
        const res = await request(app).post('/widgets?as=A').send({ name: 'a-widget', user: USER_B.toString() });
        expect(res.status).toBe(201);
        expect(String(res.body.data.user)).toBe(String(USER_A));
    });

    it('getAll returns only the acting user\'s records', async () => {
        await makeWidget(USER_A, 'a1');
        await makeWidget(USER_B, 'b1');
        const res = await request(app).get('/widgets?as=A');
        expect(res.status).toBe(200);
        expect(res.body.data.every((w: any) => String(w.user) === String(USER_A))).toBe(true);
        expect(res.body.data.some((w: any) => w.name === 'b1')).toBe(false);
    });

    it('getOne cannot read another user\'s record (404, not 200)', async () => {
        const bWidget = await makeWidget(USER_B, 'b-secret');
        const res = await request(app).get(`/widgets/${bWidget._id}?as=A`);
        expect(res.status).toBe(404);
    });

    it('updateOne cannot mutate another user\'s record (the old vuln path)', async () => {
        const bWidget = await makeWidget(USER_B, 'b-original');
        const res = await request(app).patch(`/widgets/${bWidget._id}?as=A`).send({ name: 'hacked' });
        expect(res.status).toBe(404);
        const reloaded = await Widget.findById(bWidget._id);
        expect(reloaded.name).toBe('b-original');
    });

    it('deleteOne cannot delete another user\'s record', async () => {
        const bWidget = await makeWidget(USER_B, 'b-keep');
        const res = await request(app).delete(`/widgets/${bWidget._id}?as=A`);
        expect(res.status).toBe(404);
        expect(await Widget.findById(bWidget._id)).not.toBeNull();
    });

    it('owner CAN operate on their own record', async () => {
        const aWidget = await makeWidget(USER_A, 'a-own');
        expect((await request(app).get(`/widgets/${aWidget._id}?as=A`)).status).toBe(200);
        expect((await request(app).patch(`/widgets/${aWidget._id}?as=A`).send({ name: 'renamed' })).status).toBe(200);
        expect((await request(app).delete(`/widgets/${aWidget._id}?as=A`)).status).toBe(204);
    });
});

describe('HandlerFactory fail-closed construction', () => {
    it('throws if no scope is declared (no silent cross-tenant default)', () => {
        expect(() => new HandlerFactory({ model: Widget, fields: ['name'] } as any)).toThrow(/scope/);
    });

    it('allows an explicit public collection (scope:false)', () => {
        expect(() => new HandlerFactory({ model: Widget, fields: ['name'], scope: false })).not.toThrow();
    });
});
