import TemplateInstall from '@models/templateInstall';
import HandlerFactory from '@controllers/common/handlerFactory';
import RuntimeError from '@utilities/runtimeError';
import { catchAsync } from '@utilities/helpers';
import { enqueueJob } from '@services/orchestrator';
import { IRequest } from '@typings/controllers/common';
import { Response, NextFunction } from 'express';

const TemplateInstallFactory = new HandlerFactory({
    model: TemplateInstall,
    scope: { field: 'project' },
    fields: ['name']
});

const stripInputs = async (_req: IRequest, data: any): Promise<any> => {
    const scrub = (doc: any) => {
        if(doc && typeof doc === 'object'){
            delete doc.inputs;
        }
        return doc;
    };
    if(Array.isArray(data)) return data.map(scrub);
    return scrub(data);
};

export const getTemplateInstalls = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const projectId = req.params.projectId;
    const projectIds = (req.tenant?.projectIds || []).map(String);
    if(!req.tenant?.isPlatformAdmin && !projectIds.includes(String(projectId))){
        return next(new RuntimeError('TemplateInstall::Project::Forbidden', 403));
    }
    const records = await TemplateInstall
        .find({ project: projectId })
        .populate({ path: 'template', select: 'name' })
        .lean();
    res.status(200).json({ status: 'success', data: await stripInputs(req, records) });
});

export const getTemplateInstall = TemplateInstallFactory.getOne({
    middlewares: { post: [stripInputs] }
});

export const deleteTemplateInstall = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const install = await TemplateInstall.findOne({
        _id: req.params.id,
        ...(req.tenant?.isPlatformAdmin ? {} : { project: { $in: req.tenant?.projectIds || [] } })
    });
    if(!install){
        return next(new RuntimeError('TemplateInstall::NotFound', 404));
    }

    const job = await enqueueJob({
        type: 'template:uninstall',
        target: {
            service: install._id as any,
            user: (req.user as any)?._id,
            project: install.project
        },
        payload: { installId: install._id.toString() },
        lockKey: `template-install:${install._id}`
    });

    res.status(202).json({ status: 'success', data: { installId: install._id, jobId: job._id } });
});

export default {
    getTemplateInstalls,
    getTemplateInstall,
    deleteTemplateInstall
};
