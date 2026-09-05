import type { ErrorCode, ErrorTable } from '../../shared/errors';

export const DeploymentErrors = {
    domain: 'Deployment',
    causes: {
        NotFound: 404,
        Forbidden: 403,
        OperationFailed: 500
    }
} as const satisfies ErrorTable;

export type DeploymentErrorCode = ErrorCode<typeof DeploymentErrors>;
