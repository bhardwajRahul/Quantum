import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { setupMemoryMongo } from '@tests/helpers/memoryMongo';
import { resolveTenant, resolveTenantDiscovery } from '@middlewares/tenancy';
import RuntimeError from '@utilities/runtimeError';

setupMemoryMongo();

let app: express.Express;

const ORGLESS_USER = new mongoose.Types.ObjectId();

const FOREIGN_ORG = new mongoose.Types.ObjectId();

beforeAll(async () => {

    if(!mongoose.models.Membership){
        mongoose.model('Membership', new mongoose.Schema({
            user: mongoose.Schema.Types.ObjectId,
            organization: mongoose.Schema.Types.ObjectId,
            project: mongoose.Schema.Types.ObjectId,
            role: String
        }));
    }
    if(!mongoose.models.Organization){
        mongoose.model('Organization', new mongoose.Schema({ name: String, slug: String }));
    }

    if(!mongoose.models.Project){
        mongoose.model('Project', new mongoose.Schema({ organization: mongoose.Schema.Types.ObjectId, isDefault: Boolean }));
    }

    app = express();
    app.use(express.json());

    app.use((req: any, _res, next) => {
        req.user = { _id: ORGLESS_USER, role: 'user' };
        next();
    });

    app.get('/discovery', resolveTenantDiscovery, (req: any, res) => {
        res.json({ org: req.tenant?.org?._id ?? null, orgIds: req.tenant?.orgIds?.length ?? 0 });
    });
    app.get('/scoped', resolveTenant, (req: any, res) => {
        res.json({ org: req.tenant?.org?._id ?? null });
    });
    app.use((err: any, _req: any, res: any, _next: any) => {
        const code = err instanceof RuntimeError ? err.statusCode : 500;
        res.status(code).json({ status: 'error', message: err.message });
    });
});

beforeEach(async () => {
    await mongoose.model('Organization').create({ _id: FOREIGN_ORG, name: 'foreign', slug: 'foreign' });
});

describe('resolveTenant — explicit-org-setup contract', () => {
    it('discovery route ignores a foreign org header and does not error', async () => {
        const res = await request(app)
            .get('/discovery')
            .set('x-organization-id', String(FOREIGN_ORG));
        expect(res.status).toBe(200);

        expect(res.body.org).toBeNull();
    });

    it('scoped route rejects a foreign org header with Reconfigure (409)', async () => {
        const res = await request(app)
            .get('/scoped')
            .set('x-organization-id', String(FOREIGN_ORG));
        expect(res.status).toBe(409);
        expect(res.body.message).toBe('Tenancy::Organization::Reconfigure');
    });

    it('scoped route rejects an org-less caller (no header, no default) with Reconfigure (409)', async () => {
        const res = await request(app).get('/scoped');
        expect(res.status).toBe(409);
        expect(res.body.message).toBe('Tenancy::Organization::Reconfigure');
    });
});
