import CascadeService from '../CascadeService';
import { logger } from '@/shared/utils/Logger';
import type Job from '../../models/Job';

export default class ProjectCascadeHandler{
    #cascade = new CascadeService();

    async run(job: Job): Promise<void>{
        if(job.projectId === null){
            logger.error('project cascade job has no projectId; skipping', { scope: 'orchestrator.handler.projectCascade' });
            return;
        }
        const deleted = await this.#cascade.deleteByProject(job.projectId);
        job.result = deleted;
        await job.save();
    }
}
