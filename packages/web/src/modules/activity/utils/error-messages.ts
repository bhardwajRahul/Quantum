import type { TenancyErrorCode } from '@quantum/contracts/modules/organization/errors';
import { tenancyErrorMessages } from '@/modules/organization/utils/error-messages';

export const activityErrorMessages: Partial<Record<TenancyErrorCode, string>> = {
    ...tenancyErrorMessages
};
