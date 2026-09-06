import { TenancyErrors } from '@quantum/contracts/modules/organization/errors';
import { defineErrors } from '@/shared/errors/defineErrors';

export const TenancyError = defineErrors(TenancyErrors);
