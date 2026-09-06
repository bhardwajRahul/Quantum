import type { MetricErrorCode } from '@quantum/contracts/modules/metric/errors';
import type { RepositoryErrorCode } from '@quantum/contracts/modules/repository/errors';
import { repositoryErrorMessages } from '@/modules/repository/utils/error-messages';
import { forbidden, notFound } from '@/shared/utils/error-messages';

export const metricErrorMessages: Partial<Record<MetricErrorCode | RepositoryErrorCode, string>> = {
    ...repositoryErrorMessages,
    'Metric::NotFound': notFound('metric sample'),
    'Metric::Forbidden': forbidden('metric sample')
};
