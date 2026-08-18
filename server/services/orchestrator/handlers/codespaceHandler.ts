import Codespace from '@models/codespace';
import { provisionCodespace } from '@services/codespace/provisioner';
import { emitDeploymentStatus } from '@services/orchestrator/events';
import { activityContextFromJob } from '@services/activity';
import logger from '@utilities/logger';
import { IJob } from '@typings/models/job';

export const runCodespaceJob = async (job: IJob): Promise<void> => {
    const codespaceId = job.payload?.codespaceId as string | undefined;
    if(!codespaceId){
        throw new Error('Codespace::Job::MissingCodespaceId');
    }

    const codespace = await Codespace.findById(codespaceId).select('user name organization');
    const userId = (job.target?.user || codespace?.user)?.toString();

    if(codespace?.organization) job.target.organization = codespace.organization as any;
    const act = activityContextFromJob(job);
    const label = codespace?.name ? `"${codespace.name}"` : 'codespace';

    try{
        switch(job.type){
            case 'codespace:provision':

                await provisionCodespace(codespaceId, act);
                break;
            case 'codespace:delete':

                await act.step(`Tearing down codespace ${label}`, () => Codespace.findOneAndDelete({ _id: codespaceId }));
                break;
            default:
                throw new Error(`Codespace::Job::UnknownType::${job.type}`);
        }

        const fresh = await Codespace.findById(codespaceId).select('status');
        emitDeploymentStatus(userId, {
            status: fresh?.status || (job.type === 'codespace:delete' ? 'removed' : 'running'),
            jobId: job._id.toString()
        });
        act.success(job.type === 'codespace:delete' ? `Codespace ${label} removed` : `Codespace ${label} ready`);
    }catch(error){
        logger.error(`@services/orchestrator/handlers/codespaceHandler.ts (runCodespaceJob): ${job.type} ${codespaceId}: ${error}`);
        act.fail(`Codespace job ${job.type} failed`, error);
        emitDeploymentStatus(userId, { status: 'error', jobId: job._id.toString() });
        throw error;
    }
};

export default runCodespaceJob;
