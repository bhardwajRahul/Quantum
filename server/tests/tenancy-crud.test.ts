import { describe, it, expect, beforeAll } from 'vitest';
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { setupMemoryMongo } from '@tests/helpers/memoryMongo';
import RuntimeError from '@utilities/runtimeError';
import { resolveTenant, resolveTenantDiscovery, requirePermission } from '@middlewares/tenancy';
import * as organizationController from '@controllers/organization';
import * as projectController from '@controllers/project';
import { CreateOrganizationSchema, CreateProjectSchema, OrgIdParamsSchema, IdParamsSchema } from '@middlewares/validators';
import validate from '@middlewares/validation';

setupMemoryMongo();

let app: express.Express;
const USER_A = new mongoose.Types.ObjectId();
const USER_B = new mongoose.Types.ObjectId();

const actAs = (id: mongoose.Types.ObjectId) => (req: any, _res: any, next: any) => {
    req.user = { _id: id, role: 'user' };
    next();
};

beforeAll(() => {
    app = express();
    app.use(express.json());

    app.use((req: any, _res, next) => {
        const id = req.query.as === 'B' ? USER_B : USER_A;
        return actAs(id)(req, _res, next);
    });

    app.get('/organization', resolveTenantDiscovery, organizationController.getOrganizations);
    app.post('/organization', validate(CreateOrganizationSchema), resolveTenantDiscovery, organizationController.createOrganization);

    app.get('/project/organization/:orgId', validate(OrgIdParamsSchema, 'params'), resolveTenant, projectController.getProjects);
    app.post('/project/organization/:orgId', validate(OrgIdParamsSchema, 'params'), resolveTenant, requirePermission('project:write'), projectController.createProject);

    app.use((err: any, _req: any, res: any, _next: any) => {
        const code = err instanceof RuntimeError ? err.statusCode : 500;
        res.status(code).json({ status: 'error', message: err.message });
    });
});

describe('Organization / Project CRUD + isolation', () => {
    it('creates an org and auto-grants the creator owner membership', async () => {
        const res = await request(app).post('/organization?as=A').send({ name: 'Acme' });
        expect(res.status).toBe(201);
        expect(res.body.data.name).toBe('Acme');
        expect(res.body.data.slug).toMatch(/^acme-/);

        const list = await request(app).get('/organization?as=A');
        expect(list.body.data.some((o: any) => o.name === 'Acme')).toBe(true);
    });

    it('does not show org A to user B', async () => {
        await request(app).post('/organization?as=A').send({ name: 'OnlyA' });
        const listB = await request(app).get('/organization?as=B');
        expect(listB.body.data.some((o: any) => o.name === 'OnlyA')).toBe(false);
    });

    it('lets the owner create a project under their org', async () => {
        const org = (await request(app).post('/organization?as=A').send({ name: 'WithProjects' })).body.data;
        const res = await request(app).post(`/project/organization/${org._id}?as=A`).send({ name: 'API' });
        expect(res.status).toBe(201);
        expect(String(res.body.data.organization)).toBe(String(org._id));
        const projects = await request(app).get(`/project/organization/${org._id}?as=A`);
        expect(projects.body.data.some((p: any) => p.name === 'API')).toBe(true);
    });

    it('forbids user B from creating a project in user A\'s org (403)', async () => {
        const org = (await request(app).post('/organization?as=A').send({ name: 'Guarded' })).body.data;
        const res = await request(app).post(`/project/organization/${org._id}?as=B`).send({ name: 'sneaky' });

        expect(res.status).toBe(403);
    });
});
