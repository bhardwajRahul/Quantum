import { cascadeDeleteProject } from '@services/tenancy/cascade';
import logger from '@utilities/logger';
import { IJob } from '@typings/models/job';

export const runProjectCascadeDelete = async (job: IJob): Promise<void> => {
    const projectId = job.target?.project;
    if(!projectId){
        logger.error('@services/orchestrator/handlers/projectCascadeHandler: job has no target.project; skipping.');
        return;
    }
    const result = await cascadeDeleteProject(projectId);
    job.result = result.deleted as any;
};

export default { runProjectCascadeDelete };
