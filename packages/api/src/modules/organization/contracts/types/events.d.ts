import type { OrganizationCreatedPayload, OrganizationDeletedPayload } from '../domain/events';

declare global{
    interface EventMap{
        'organization.created': OrganizationCreatedPayload;
        'organization.deleted': OrganizationDeletedPayload;
    }
}
