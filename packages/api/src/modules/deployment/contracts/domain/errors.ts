import { DeploymentErrors } from '@quantum/contracts/modules/deployment/errors';
import { defineErrors } from '@/shared/errors/defineErrors';

export const DeploymentError = defineErrors(DeploymentErrors);
