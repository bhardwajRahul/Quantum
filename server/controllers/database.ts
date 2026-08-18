import Database from '@models/database';
import DockerContainer from '@models/docker/container';
import HandlerFactory from '@controllers/common/handlerFactory';
import RuntimeError from '@utilities/runtimeError';
import { catchAsync } from '@utilities/helpers';
import { enqueueDatabaseJob } from '@services/orchestrator';
import { resolveProjectOr403 } from '@middlewares/tenancy';
import { IRequest } from '@typings/controllers/common';
import { Response, NextFunction } from 'express';

const DatabaseFactory = new HandlerFactory({
    model: Database,
    scope: { field: 'organization' },
    fields: ['name']
});

export const getDatabases = DatabaseFactory.getAll();
export const getDatabase = DatabaseFactory.getOne();

const reachableScope = (req: IRequest): Record<string, unknown> =>
    req.tenant?.isPlatformAdmin ? {} : { project: { $in: req.tenant?.projectIds || [] } };

const findReachableDatabase = async (req: IRequest, select?: string) => {
    const query = Database.findOne({ _id: req.params.id, ...reachableScope(req) });
    return select ? query.select(select) : query;
};

export const createDatabase = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const project = await resolveProjectOr403(req, next, 'Database');
    if(!project) return;

    const userId = (req.user as any)?._id;
    const database = await Database.create({
        name: req.body.name,
        engine: req.body.engine,
        version: req.body.version,
        organization: project.organization,
        project: project._id,
        user: userId,
        status: 'pending'
    });

    await enqueueDatabaseJob('db:provision', database._id.toString(), {
        userId: userId?.toString(),
        projectId: project._id.toString()
    });

    res.status(202).json({ status: 'success', data: database });
});

export const backupDatabase = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const database = await findReachableDatabase(req);
    if(!database){
        return next(new RuntimeError('Database::NotFound', 404));
    }
    const job = await enqueueDatabaseJob('db:backup', database._id.toString(), {
        userId: (req.user as any)?._id?.toString(),
        projectId: database.project?.toString()
    });
    res.status(202).json({ status: 'success', data: { jobId: job._id } });
});

export const restoreDatabase = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const backupId = req.body?.backupId;
    if(!backupId){
        return next(new RuntimeError('Database::Restore::BackupIdRequired', 400));
    }
    const database = await findReachableDatabase(req);
    if(!database){
        return next(new RuntimeError('Database::NotFound', 404));
    }
    const job = await enqueueDatabaseJob('db:restore', database._id.toString(), {
        userId: (req.user as any)?._id?.toString(),
        projectId: database.project?.toString(),
        backupId
    });
    res.status(202).json({ status: 'success', data: { jobId: job._id } });
});

export const getConnectionString = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const database = await findReachableDatabase(req, '+connectionStringEnc');
    if(!database){
        return next(new RuntimeError('Database::NotFound', 404));
    }
    const connectionString = database.getConnectionString();
    if(!connectionString){
        return next(new RuntimeError('Database::ConnectionString::Unavailable', 409));
    }
    res.status(200).json({ status: 'success', data: { connectionString } });
});

export const deleteDatabase = DatabaseFactory.deleteOne({
    middlewares: {
        pre: [async (req: IRequest) => {

            const database = await Database.findOne({ _id: req.params.id });
            if(database?.container){

                await DockerContainer.findOneAndDelete({ _id: database.container });
            }
            return {};
        }]
    }
});

export default {
    getDatabases,
    getDatabase,
    createDatabase,
    backupDatabase,
    restoreDatabase,
    getConnectionString,
    deleteDatabase
};
