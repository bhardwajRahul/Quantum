import { GatewayErrors } from '@quantum/contracts/shared/errors';
import { defineErrors } from '@/shared/errors/defineErrors';

export const GatewayError = defineErrors(GatewayErrors);
