import { InferSchemaType } from 'mongoose';
import { HealthCheckSchema } from '@models/healthCheck';

export type HealthCheckType = 'http' | 'tcp' | 'cmd';
export type HealthStatus = 'healthy' | 'unhealthy' | 'unknown';

export type IHealthCheck = HydratedDocument<InferSchemaType<typeof HealthCheckSchema>>;
