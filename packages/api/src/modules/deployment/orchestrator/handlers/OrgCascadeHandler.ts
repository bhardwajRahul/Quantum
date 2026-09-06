import CascadeService from '../CascadeService';
import { logger } from '@/shared/utils/Logger';
import type Job from '../../models/Job';

export default class OrgCascadeHandler{
    #cascade = new CascadeService();

    async run(job: Job): Promise<void>{
        if(job.organizationId === null){
            logger.error('org cascade job has no organizationId; skipping', { scope: 'orchestrator.handler.orgCascade' });
            return;
        }
        const deleted = await this.#cascade.deleteByOrganization(job.organizationId);
        job.result = deleted;
        await job.save();
    }
}
