import { DatabaseErrors } from '@quantum/contracts/modules/database/errors';
import { defineErrors } from '@/shared/errors/defineErrors';

export const DatabaseError = defineErrors(DatabaseErrors);
