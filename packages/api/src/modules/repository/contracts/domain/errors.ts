import { RepositoryErrors } from '@quantum/contracts/modules/repository/errors';
import { defineErrors } from '@/shared/errors/defineErrors';

export const RepositoryError = defineErrors(RepositoryErrors);
