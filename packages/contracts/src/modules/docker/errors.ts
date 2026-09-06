import type { ErrorCode, ErrorTable } from '../../shared/errors';

export const DockerErrors = {
    domain: 'Docker',
    causes: {
        NotFound: 404,
        OperationFailed: 500
    }
} as const satisfies ErrorTable;

export type DockerErrorCode = ErrorCode<typeof DockerErrors>;
