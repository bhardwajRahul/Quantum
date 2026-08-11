import type { HealthCheckChangedPayload } from '../domain/events';

declare global{
    interface EventMap{
        'healthcheck.changed': HealthCheckChangedPayload;
    }
}
