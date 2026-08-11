import TemplateInstall from '@/modules/template/models/TemplateInstall';
import { JobType } from '@quantum/contracts/modules/deployment/domain';
import { logger } from '@/shared/utils/Logger';
import type Job from '../../models/Job';

export default class TemplateHandler{
    async run(job: Job): Promise<void>{
        const installId = job.templateInstallId ?? (job.payload.installId as number | undefined);
        if(installId === undefined) throw new Error('Template::Job::MissingInstallId');

        const install = await TemplateInstall.findOneBy({ id: installId });
        if(!install) throw new Error(`Template::Job::InstallNotFound::${installId}`);

        if(job.type === JobType.TemplateInstall) return this.#install(install);
        if(job.type === JobType.TemplateUninstall) return this.#uninstall(install);
        throw new Error(`Template::Job::UnknownType::${job.type}`);
    }

    async #install(install: TemplateInstall): Promise<void>{
        logger.info(
            `template install ${install.id} (${install.name}) requested; service provisioning deferred ` +
            '(new TemplateInstall model carries no status/services/network fields in this port)',
            { scope: 'orchestrator.handler.template' }
        );
    }

    async #uninstall(install: TemplateInstall): Promise<void>{
        logger.info(`template uninstall ${install.id} (${install.name}) requested; service teardown deferred`, { scope: 'orchestrator.handler.template' });
    }
}
