import { createApi } from '@/shared/api/create-api';
import { useQuery } from '@/shared/hooks/api/use-query';
import { serverRoutes } from '@quantum/contracts/modules/server/routes';

const serverApi = createApi(serverRoutes);

const fallbackHost = (): string => (typeof window === 'undefined' ? 'localhost' : window.location.hostname);

export const usePublicHost = (): string => {
    const address = useQuery(serverApi.publicAddress, []);
    return address.data?.host ?? fallbackHost();
};

export const portUrl = (host: string, externalPort: number): string => `http://${host}:${externalPort}`;
