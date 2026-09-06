import { defineErrors } from '@/shared/errors/defineErrors';

export const RouteError = defineErrors({
    domain: 'Route',
    causes: {
        PrefixMismatch: 500
    }
});
