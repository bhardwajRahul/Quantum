import type { DomainCreatedPayload, DomainDeletedPayload } from '../domain/events';

declare global{
    interface EventMap{
        'domain.created': DomainCreatedPayload;
        'domain.deleted': DomainDeletedPayload;
    }
}
