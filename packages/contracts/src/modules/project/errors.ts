import type { ErrorCode, ErrorTable } from '../../shared/errors';

export const ProjectErrors = {
    domain: 'Project',
    causes: {
        NotFound: 404,
        Forbidden: 403,
        SlugAlreadyTaken: 409
    }
} as const satisfies ErrorTable;

export type ProjectErrorCode = ErrorCode<typeof ProjectErrors>;

export const EnvironmentErrors = {
    domain: 'Environment',
    causes: {
        NotFound: 404,
        Forbidden: 403,
        NameAlreadyTaken: 409
    }
} as const satisfies ErrorTable;

export type EnvironmentErrorCode = ErrorCode<typeof EnvironmentErrors>;
