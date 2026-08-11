import { defineErrors } from '@/shared/errors/defineErrors';

export const EventError = defineErrors({
    domain: 'Events',
    causes: {
        UndefinedGroup: 500
    }
});
