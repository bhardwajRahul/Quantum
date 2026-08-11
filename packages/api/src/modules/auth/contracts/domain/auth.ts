export interface Principal{
    userId: number;
}

export interface TokenPayload{
    sub: string;
    iat: number;
    iatMs: number;
}
