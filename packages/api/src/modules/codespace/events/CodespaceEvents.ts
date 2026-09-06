import { DefineEventGroup } from '@/shared/events/EventGroup';
import { eventBus } from '@/shared/events/EventBus';
import CodespaceService from '../services/CodespaceService';
import type { RepositoryDeletedPayload } from '@/modules/repository/contracts/domain/events';
import type { TemplateUninstalledPayload } from '@/modules/template/contracts/domain/events';

@DefineEventGroup('codespace')
export default class CodespaceEvents{
    #service = new CodespaceService();

    constructor(){
        eventBus.subscribe('repository.deleted', (payload) =>
            this.#service.removeForTarget({ repositoryId: (payload as RepositoryDeletedPayload).repositoryId }));
        eventBus.subscribe('template.uninstalled', (payload) =>
            this.#service.removeForTarget({ templateInstallId: (payload as TemplateUninstalledPayload).templateInstallId }));
    }
}
