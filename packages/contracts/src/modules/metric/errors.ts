import type { ErrorCode, ErrorTable } from '../../shared/errors';

export const MetricErrors = {
    domain: 'Metric',
    causes: {
        NotFound: 404,
        Forbidden: 403
    }
} as const satisfies ErrorTable;

export type MetricErrorCode = ErrorCode<typeof MetricErrors>;
