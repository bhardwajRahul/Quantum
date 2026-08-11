import type { ClientError } from '@/shared/errors/ClientError';

export type ClientErrorFactory = (detail?: string) => ClientError;

export interface ErrorCopy{
    (source: Error | string): string;
    (source: Error | string | undefined): string | null;
}
