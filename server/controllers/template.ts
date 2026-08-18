import crypto from 'crypto';
import slugify from 'slugify';
import Template from '@models/template';
import TemplateInstall from '@models/templateInstall';
import RuntimeError from '@utilities/runtimeError';
import { catchAsync } from '@utilities/helpers';
import { encrypt } from '@utilities/encryption';
import { parseCompose } from '@services/templates/compose';
import { enqueueJob } from '@services/orchestrator';
import { resolveProjectOr403 } from '@middlewares/tenancy';
import { IRequest } from '@typings/controllers/common';
import { ITemplate, InputDef } from '@typings/models/template';
import { Response, NextFunction } from 'express';

const visibleOrgIds = (req: IRequest): string[] => (req.tenant?.orgIds || []).map(String);

const catalogFilter = (req: IRequest, extra: Record<string, any> = {}): Record<string, any> => {
    if(req.tenant?.isPlatformAdmin) return extra;
    return {
        ...extra,
        $or: [
            { organization: null },
            { organization: { $in: visibleOrgIds(req) } }
        ]
    };
};

export const getTemplates = catchAsync(async (req: IRequest, res: Response): Promise<void> => {
    const filter: Record<string, any> = catalogFilter(req);
    if(req.query.category) filter.category = req.query.category;

    if(req.query.all !== 'true') filter.isLatest = true;

    const templates = await Template.find(filter).sort({ name: 1 }).lean();
    res.status(200).json({
        status: 'success',
        results: { total: templates.length },
        data: templates
    });
});

export const getTemplate = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const template = await Template.findOne(catalogFilter(req, { _id: req.params.id })).lean();
    if(!template){
        return next(new RuntimeError('Template::NotFound', 404));
    }
    res.status(200).json({ status: 'success', data: template });
});

export const getCategories = catchAsync(async (req: IRequest, res: Response): Promise<void> => {
    const categories = await Template.distinct('category', catalogFilter(req));
    res.status(200).json({ status: 'success', data: categories.filter(Boolean).sort() });
});

export const createTemplate = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const orgId = req.tenant?.org?._id;
    if(!orgId && !req.tenant?.isPlatformAdmin){
        return next(new RuntimeError('Template::Organization::Required', 400));
    }

    let spec;
    try{
        spec = parseCompose(req.body.spec);
    }catch(error: any){
        return next(new RuntimeError(error?.message || 'Template::Compose::Invalid', 400));
    }

    const slug = req.body.slug || slugify(req.body.name, { lower: true, strict: true });
    const version = req.body.version || '1.0.0';

    const exists = await Template.findOne({ slug, version });
    if(exists){
        return next(new RuntimeError('Template::Version::AlreadyExists', 409));
    }

    await Template.updateMany(
        { slug, organization: orgId || null },
        { isLatest: false }
    );

    const template = await Template.create({
        name: req.body.name,
        slug,
        version,
        category: req.body.category || 'other',
        description: req.body.description,
        icon: req.body.icon,
        website: req.body.website,
        source: 'custom',
        organization: orgId || null,
        spec,
        inputsSchema: (req.body.inputsSchema || []) as InputDef[],
        isLatest: true
    });

    res.status(201).json({ status: 'success', data: template });
});

export const deleteTemplate = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const filter: Record<string, any> = { _id: req.params.id, source: 'custom' };
    if(!req.tenant?.isPlatformAdmin){
        filter.organization = { $in: visibleOrgIds(req) };
    }
    const template = await Template.findOneAndDelete(filter);
    if(!template){
        return next(new RuntimeError('Template::NotFound', 404));
    }
    res.status(204).json({ status: 'success', data: null });
});

const resolveInputs = (template: ITemplate, supplied: Record<string, any>): Map<string, string> => {
    const out = new Map<string, string>();
    for(const def of (template.inputsSchema || []) as InputDef[]){
        let value: string | undefined;

        if(def.generate){
            const bytes = def.generate === 'token' ? 32 : 24;
            value = crypto.randomBytes(bytes).toString('base64url');
        }else if(supplied[def.key] !== undefined){
            value = String(supplied[def.key]);
        }else if(def.default !== undefined){
            value = String(def.default);
        }

        if(value === undefined){
            if(def.required){
                throw new RuntimeError(`Template::Install::MissingInput::${def.key}`, 400);
            }
            continue;
        }

        const sensitive = def.type === 'secret' || !!def.generate;
        out.set(def.key, sensitive ? encrypt(value) : encrypt(value));
    }
    return out;
};

export const installTemplate = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const project = await resolveProjectOr403(req, next, 'Template::Install');
    if(!project) return;

    const templateFilter = catalogFilter(req, { _id: req.body.template });
    if(req.body.version) templateFilter.version = req.body.version;
    else templateFilter.isLatest = true;
    const template = await Template.findOne(templateFilter);
    if(!template){
        return next(new RuntimeError('Template::Install::TemplateNotFound', 404));
    }

    const inputs = resolveInputs(template as ITemplate, req.body.inputs || {});

    const install = await TemplateInstall.create({
        template: template._id,
        templateVersion: template.version,
        name: req.body.name,
        organization: project.organization,
        project: project._id,
        environment: req.body.environment,
        user: (req.user as any)?._id,
        nodeId: process.env.NODE_ID || 'local',
        inputs,
        status: 'pending'
    });

    const job = await enqueueJob({
        type: 'template:install',
        target: {
            service: install._id as any,
            user: (req.user as any)?._id,
            project: project._id
        },
        payload: { installId: install._id.toString() },
        lockKey: `template-install:${install._id}`
    });

    res.status(202).json({ status: 'success', data: { installId: install._id, jobId: job._id } });
});

export default {
    getTemplates,
    getTemplate,
    getCategories,
    createTemplate,
    deleteTemplate,
    installTemplate
};
