import type { ErrorCode, ErrorTable } from '../../shared/errors';

export const GithubErrors = {
    domain: 'Github',
    causes: {
        NotConfigured: 500,
        NotConnected: 404,
        ExchangeFailed: 502,
        AccountNotFound: 404,
        StateMismatch: 401
    }
} as const satisfies ErrorTable;

export type GithubErrorCode = ErrorCode<typeof GithubErrors>;
