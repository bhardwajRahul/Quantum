import type { UserCreatedPayload, UserDeletedPayload } from '../domain/events';

declare global{
    interface EventMap{
        'user.created': UserCreatedPayload;
        'user.deleted': UserDeletedPayload;
    }
}
