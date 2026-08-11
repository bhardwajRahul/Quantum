import { RateLimitErrors } from '@quantum/contracts/shared/errors';
import { defineErrors } from '@/shared/errors/defineErrors';

export const RateLimitError = defineErrors(RateLimitErrors);
