import { call } from '@/shared/api/call';
import { repositoryRoutes } from '@quantum/contracts/modules/repository/routes';
import type {
    CreateRepositoryInput,
    RepositoryOperationInput,
    StorageWriteInput,
    UpdateRepositoryInput
} from '@quantum/contracts/modules/repository/http';

const encodeStoragePath = (dir: string): string =>
    dir.split('/').filter((segment) => segment !== '').map(encodeURIComponent).join('/');

const explorePath = (dir: string): string => {
    const segments = encodeStoragePath(dir);
    if(segments === '') return repositoryRoutes.storageExploreRoot.path;
    return repositoryRoutes.storageExplore.path.replace('*', segments);
};

export const repositoryApi = {
    mine: () => call(repositoryRoutes.mine),

    create: (body: CreateRepositoryInput) => call(repositoryRoutes.create, { body }),

    get: (id: number) => call(repositoryRoutes.get, { path: { id } }),

    update: (id: number, body: UpdateRepositoryInput) => call(repositoryRoutes.update, { path: { id }, body }),

    remove: (id: number) => call(repositoryRoutes.remove, { path: { id } }),

    operate: (id: number, body: RepositoryOperationInput) =>
        call(repositoryRoutes.operate, { path: { id }, body }),

    rollback: (id: number, deploymentId: number) =>
        call(repositoryRoutes.rollback, { path: { id, deploymentId } }),

    // call() only interpolates :params, so the contract wildcard is resolved here
    storageExplore: (id: number, dir: string) =>
        call({ ...repositoryRoutes.storageExplore, path: explorePath(dir) }, { path: { id } }),

    storageExploreRoot: (id: number) => call(repositoryRoutes.storageExploreRoot, { path: { id } }),

    storageRead: (id: number, filePath: string) =>
        call(repositoryRoutes.storageRead, { path: { id }, query: { path: filePath } }),

    storageWrite: (id: number, body: StorageWriteInput) =>
        call(repositoryRoutes.storageWrite, { path: { id }, body })
};
