import { ClientError } from '@/shared/errors/ClientError';
import type { ErrorTable } from '@quantum/contracts/shared/errors';
import type { ClientErrorFactory } from '@/shared/contracts/errors';

export const defineErrors = <T extends ErrorTable>({ domain, causes }: T): Record<keyof T['causes'], ClientErrorFactory> => {
    const factories = {} as Record<keyof T['causes'], ClientErrorFactory>;
    for(const cause of Object.keys(causes)){
        factories[cause as keyof T['causes']] = (detail?: string) =>
            new ClientError(detail === undefined ? `${domain}::${cause}` : `${domain}::${cause}:${detail}`);
    }
    return factories;
};
