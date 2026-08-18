import Codespace from '@models/codespace';
import HandlerFactory from '@controllers/common/handlerFactory';
import RuntimeError from '@utilities/runtimeError';
import { catchAsync } from '@utilities/helpers';
import { decrypt } from '@utilities/encryption';
import { enqueueCodespaceJob } from '@services/orchestrator';
import { resolveProjectOr403 } from '@middlewares/tenancy';
import { IRequest } from '@typings/controllers/common';
import { Response, NextFunction } from 'express';

const CodespaceFactory = new HandlerFactory({
    model: Codespace,
    scope: { field: 'organization' },
    fields: ['name']
});

export const getCodespaces = CodespaceFactory.getAll();
export const getCodespace = CodespaceFactory.getOne();

const CPU_MIN = 1, CPU_MAX = 8;
const MEM_MIN = 512, MEM_MAX = 16384;
const DISK_MIN = 1, DISK_MAX = 100;

export const createCodespace = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const project = await resolveProjectOr403(req, next, 'Codespace');
    if(!project) return;

    const name = (req.body.name || '').trim();
    if(!name){
        return next(new RuntimeError('Codespace::Name::Required', 400));
    }

    const cpuCores = Number(req.body.cpuCores ?? 1);
    const memoryMb = Number(req.body.memoryMb ?? 2048);
    const diskGb = Number(req.body.diskGb ?? 10);
    if(
        !Number.isFinite(cpuCores) || cpuCores < CPU_MIN || cpuCores > CPU_MAX ||
        !Number.isFinite(memoryMb) || memoryMb < MEM_MIN || memoryMb > MEM_MAX ||
        !Number.isFinite(diskGb) || diskGb < DISK_MIN || diskGb > DISK_MAX
    ){
        return next(new RuntimeError('Codespace::Resources::Invalid', 400));
    }

    const userId = (req.user as any)?._id;
    const codespace = await Codespace.create({
        organization: project.organization,
        project: project._id,
        user: userId,
        name,
        cpuCores,
        memoryMb,
        diskGb,
        status: 'pending'
    });

    await enqueueCodespaceJob('codespace:provision', codespace._id.toString(), {
        userId: userId?.toString(),
        projectId: project._id.toString()
    });

    res.status(202).json({ status: 'success', data: codespace });
});

export const getAccess = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const codespace = await Codespace.findOne({
        _id: req.params.id,
        ...(req.tenant?.isPlatformAdmin ? {} : { organization: { $in: req.tenant?.orgIds || [] } })
    }).select('+passwordEnc accessUrl');
    if(!codespace){
        return next(new RuntimeError('Codespace::NotFound', 404));
    }
    if(!codespace.passwordEnc || !codespace.accessUrl){
        return next(new RuntimeError('Codespace::Access::Unavailable', 409));
    }
    res.status(200).json({
        status: 'success',
        data: { accessUrl: codespace.accessUrl, password: decrypt(codespace.passwordEnc) }
    });
});

export const deleteCodespace = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const codespace = await Codespace.findOne({
        _id: req.params.id,
        ...(req.tenant?.isPlatformAdmin ? {} : { organization: { $in: req.tenant?.orgIds || [] } })
    });
    if(!codespace){
        return next(new RuntimeError('Codespace::NotFound', 404));
    }
    const job = await enqueueCodespaceJob('codespace:delete', codespace._id.toString(), {
        userId: (req.user as any)?._id?.toString(),
        projectId: codespace.project?.toString()
    });
    res.status(202).json({ status: 'success', data: { jobId: job._id } });
});

export default {
    getCodespaces,
    getCodespace,
    createCodespace,
    getAccess,
    deleteCodespace
};
