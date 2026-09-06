import { DefineEventGroup, Event } from '@/shared/events/EventGroup';
import OrganizationService from '../services/OrganizationService';
import type { UserCreatedPayload } from '@/modules/user/contracts/domain/events';

const DEFAULT_ORGANIZATION_NAME = 'Default';

@DefineEventGroup('user')
export default class OrganizationEvents{
    #organizations = new OrganizationService();

    @Event('created')
    async created({ userId }: UserCreatedPayload): Promise<void>{
        await this.#organizations.create(userId, { name: DEFAULT_ORGANIZATION_NAME });
    }
}
