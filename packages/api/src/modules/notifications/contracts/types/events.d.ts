import type { SendEmailPayload } from '../domain/notification';

declare global{
    interface EventMap{
        'notification.send': SendEmailPayload;
    }
}
