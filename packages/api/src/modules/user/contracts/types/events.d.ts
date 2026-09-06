import type { UserCreatedPayload } from '../domain/events';

declare global{
    interface EventMap{
        'user.created': UserCreatedPayload;
    }
}
