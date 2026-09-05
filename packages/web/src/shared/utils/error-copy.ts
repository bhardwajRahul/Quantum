export interface ErrorCopy{
    (source: Error | string): string;
    (source: Error | string | undefined): string | null;
}

const FALLBACK = 'Something went wrong';

const baseOf = (code: string): string => {
    const parts = code.split(':').filter((part) => part !== '');
    return parts.length > 2 ? `${parts[0]}::${parts[1]}` : code;
};

export const errorCopy = <C extends string>(messages: Partial<Record<C, string>>): ErrorCopy =>
    ((source: Error | string | undefined) => {
        if(source === undefined) return null;

        const code = typeof source === 'string' ? source : source.message;
        return messages[code as C] ?? messages[baseOf(code) as C] ?? FALLBACK;
    }) as ErrorCopy;
