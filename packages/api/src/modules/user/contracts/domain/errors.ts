import { UserErrors } from '@quantum/contracts/modules/user/errors';
import { defineErrors } from '@/shared/errors/defineErrors';

export const UserError = defineErrors(UserErrors);
