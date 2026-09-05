export interface ErrorTable{
    readonly domain: string;
    readonly causes: Readonly<Record<string, number>>;
}

export type ErrorCode<T extends ErrorTable> =
    `${T['domain']}::${Extract<keyof T['causes'], string>}`;

export const GatewayErrors = {
    domain: 'Gateway',
    causes: {
        MissingChannel: 500,
        MalformedFrame: 400,
        UnknownMessageType: 400,
        NotJoined: 409,
        Internal: 500
    }
} as const satisfies ErrorTable;

export type GatewayErrorCode = ErrorCode<typeof GatewayErrors>;

export const RateLimitErrors = {
    domain: 'RateLimit',
    causes: {
        TooManyRequests: 429,
        InvalidWindow: 500
    }
} as const satisfies ErrorTable;

export type RateLimitErrorCode = ErrorCode<typeof RateLimitErrors>;

export const RequestErrors = {
    domain: 'Request',
    causes: {
        InvalidId: 400,
        InvalidPagination: 400,
        FileMissing: 400,
        FileTooLarge: 413,
        ValidationFailed: 400
    }
} as const satisfies ErrorTable;

export type RequestErrorCode = ErrorCode<typeof RequestErrors>;
