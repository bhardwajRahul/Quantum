import type { ErrorCopy } from '@/shared/contracts/errors';

const FALLBACK = 'Something went wrong';

export const errorCopy = <C extends string>(messages: Partial<Record<C, string>>): ErrorCopy =>
    ((source: Error | string | undefined) => {
        if(source === undefined) return null;

        const code = typeof source === 'string' ? source : source.message;
        return messages[code as C] ?? FALLBACK;
    }) as ErrorCopy;
