import { HealthCheckErrors } from '@quantum/contracts/modules/health-check/errors';
import { defineErrors } from '@/shared/errors/defineErrors';

export const HealthCheckError = defineErrors(HealthCheckErrors);
