import type { ErrorCode, ErrorTable } from '../../shared/errors';

export const DomainErrors = {
    domain: 'Domain',
    causes: {
        NotFound: 404,
        Forbidden: 403,
        AlreadyExists: 409
    }
} as const satisfies ErrorTable;

export type DomainErrorCode = ErrorCode<typeof DomainErrors>;
