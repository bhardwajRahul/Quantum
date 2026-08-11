import type { ErrorCode, ErrorTable } from '../../shared/errors';

export const HealthCheckErrors = {
    domain: 'HealthCheck',
    causes: {
        NotFound: 404,
        Forbidden: 403
    }
} as const satisfies ErrorTable;

export type HealthCheckErrorCode = ErrorCode<typeof HealthCheckErrors>;
