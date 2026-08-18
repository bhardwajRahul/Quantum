import Database from '@models/database';
import { provisionDatabase, backupDatabase, restoreDatabase } from '@services/database/provisioner';
import { emitDeploymentStatus } from '@services/orchestrator/events';
import { activityContextFromJob } from '@services/activity';
import logger from '@utilities/logger';
import { IJob } from '@typings/models/job';

export const runDatabaseJob = async (job: IJob): Promise<void> => {
    const databaseId = job.payload?.databaseId as string | undefined;
    if(!databaseId){
        throw new Error('Database::Job::MissingDatabaseId');
    }

    const database = await Database.findById(databaseId);
    if(!database){
        throw new Error(`Database::Job::NotFound::${databaseId}`);
    }
    const userId = (job.target?.user || database.user)?.toString();

    if((database as any).organization) job.target.organization = (database as any).organization;
    const act = activityContextFromJob(job);

    try{
        switch(job.type){
            case 'db:provision':

                await provisionDatabase(database, act);
                break;
            case 'db:backup':
                await backupDatabase(database, act);
                break;
            case 'db:restore': {
                const backupId = job.payload?.backupId as string | undefined;
                if(!backupId){
                    throw new Error('Database::Job::Restore::MissingBackupId');
                }
                await restoreDatabase(database, backupId, act);
                break;
            }
            default:
                throw new Error(`Database::Job::UnknownType::${job.type}`);
        }

        const fresh = await Database.findById(databaseId).select('status');
        emitDeploymentStatus(userId, {
            status: fresh?.status || 'running',
            jobId: job._id.toString()
        });
        act.success(`Database ${job.type.split(':')[1]} completed`);
    }catch(error){
        logger.error(`@services/orchestrator/handlers/databaseHandler.ts (runDatabaseJob): ${job.type} ${databaseId}: ${error}`);
        act.fail(`Database job ${job.type} failed`, error);
        emitDeploymentStatus(userId, { status: 'error', jobId: job._id.toString() });

        throw error;
    }
};

export default runDatabaseJob;
