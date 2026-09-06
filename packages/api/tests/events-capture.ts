import { beforeEach } from 'vitest';
import { eventBus } from '@/shared/events/EventBus';

export const captureEvents = <T>(event: keyof EventMap): T[] => {
    const received: T[] = [];
    eventBus.subscribe(event, (payload) => {
        received.push(payload as T);
    });
    beforeEach(() => {
        received.length = 0;
    });
    return received;
};
