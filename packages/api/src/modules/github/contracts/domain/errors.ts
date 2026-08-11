import { GithubErrors } from '@quantum/contracts/modules/github/errors';
import { defineErrors } from '@/shared/errors/defineErrors';

export const GithubError = defineErrors(GithubErrors);
