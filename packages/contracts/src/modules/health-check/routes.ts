import { del, get, patch, post } from '../../shared/routing';
import type { CreateHealthCheckInput, UpdateHealthCheckInput } from './http';
import type { HealthCheck } from './domain';

export const healthCheckRoutes = {
    listByRepository: get<HealthCheck[]>('/health-check/repository/:repositoryId'),
    create: post<CreateHealthCheckInput, HealthCheck>('/health-check/repository/:repositoryId'),
    get: get<HealthCheck>('/health-check/:id'),
    update: patch<UpdateHealthCheckInput, HealthCheck>('/health-check/:id'),
    remove: del('/health-check/:id')
};
