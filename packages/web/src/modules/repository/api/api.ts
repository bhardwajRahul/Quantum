import { call } from '@/shared/api/call';
import { createApi } from '@/shared/api/create-api';
import { repositoryRoutes } from '@quantum/contracts/modules/repository/routes';

const encodeStoragePath = (dir: string): string =>
    dir.split('/').filter((segment) => segment !== '').map(encodeURIComponent).join('/');

const explorePath = (dir: string): string => {
    const segments = encodeStoragePath(dir);
    if(segments === '') return repositoryRoutes.storageExploreRoot.path;
    return repositoryRoutes.storageExplore.path.replace('*', segments);
};

export const repositoryApi = {
    ...createApi(repositoryRoutes),

    // call() only interpolates :params, so the contract wildcard is resolved here
    storageExplore: (id: number, dir: string) =>
        call({ ...repositoryRoutes.storageExplore, path: explorePath(dir) }, { path: { id } })
};
