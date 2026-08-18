import { cascadeDeleteOrganization } from '@services/tenancy/cascade';
import logger from '@utilities/logger';
import { IJob } from '@typings/models/job';

export const runOrgCascadeDelete = async (job: IJob): Promise<void> => {
    const organizationId = job.target?.organization;
    if(!organizationId){
        logger.error('@services/orchestrator/handlers/orgCascadeHandler: job has no target.organization; skipping.');
        return;
    }
    const result = await cascadeDeleteOrganization(organizationId);
    job.result = result.deleted as any;
};

export default { runOrgCascadeDelete };
