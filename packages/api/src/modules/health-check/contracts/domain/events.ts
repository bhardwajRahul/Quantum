export interface HealthCheckChangedPayload{
    healthCheckId: number;
    action: 'create' | 'update' | 'delete';
}
