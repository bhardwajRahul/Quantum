import type { ErrorCode, ErrorTable } from '../../shared/errors';

export const CodespaceErrors = {
    domain: 'Codespace',
    causes: {
        NotFound: 404,
        Forbidden: 403,
        ProvisionFailed: 500,
        TargetNotReady: 409
    }
} as const satisfies ErrorTable;

export type CodespaceErrorCode = ErrorCode<typeof CodespaceErrors>;

export const PortBindingErrors = {
    domain: 'PortBinding',
    causes: {
        NotFound: 404,
        Forbidden: 403,
        PortUnavailable: 409
    }
} as const satisfies ErrorTable;

export type PortBindingErrorCode = ErrorCode<typeof PortBindingErrors>;
