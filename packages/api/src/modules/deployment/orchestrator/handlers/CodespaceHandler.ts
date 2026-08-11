import Codespace from '@/modules/codespace/models/Codespace';
import { CodespaceStatus } from '@quantum/contracts/modules/codespace/domain';
import { JobType } from '@quantum/contracts/modules/deployment/domain';
import { logger } from '@/shared/utils/Logger';
import type Job from '../../models/Job';

export default class CodespaceHandler{
    async run(job: Job): Promise<void>{
        const codespaceId = job.payload.codespaceId as number | undefined;
        if(codespaceId === undefined) throw new Error('Codespace::Job::MissingCodespaceId');

        if(job.type === JobType.CodespaceDelete){
            await this.#delete(codespaceId);
            return;
        }
        if(job.type === JobType.CodespaceProvision){
            await this.#provision(codespaceId);
            return;
        }
        throw new Error(`Codespace::Job::UnknownType::${job.type}`);
    }

    async #provision(codespaceId: number): Promise<void>{
        const codespace = await Codespace.findOneBy({ id: codespaceId });
        if(!codespace) throw new Error(`Codespace::Job::NotFound::${codespaceId}`);
        codespace.status = CodespaceStatus.Provisioning;
        await codespace.save();
        logger.info(`codespace ${codespaceId} provisioning requested (container backend deferred in this port)`, { scope: 'orchestrator.handler.codespace' });
    }

    async #delete(codespaceId: number): Promise<void>{
        const codespace = await Codespace.findOneBy({ id: codespaceId });
        if(!codespace) return;
        await codespace.remove();
        logger.info(`codespace ${codespaceId} removed`, { scope: 'orchestrator.handler.codespace' });
    }
}
