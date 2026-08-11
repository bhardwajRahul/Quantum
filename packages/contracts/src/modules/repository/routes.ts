import { del, get, patch, post } from '../../shared/routing';
import type { CreateRepositoryInput, RepositoryOperationInput, StorageWriteInput, UpdateRepositoryInput } from './http';
import type { ContainerEntry, ContainerFile, Repository, RollbackAccepted, WebhookOutcome } from './domain';

export const repositoryRoutes = {
    mine: get<Repository[]>('/repository/me'),
    create: post<CreateRepositoryInput, Repository>('/repository'),
    listAll: get<Repository[]>('/repository'),
    get: get<Repository>('/repository/:id'),
    update: patch<UpdateRepositoryInput, Repository>('/repository/:id'),
    remove: del('/repository/:id'),
    operate: post<RepositoryOperationInput, Repository>('/repository/:id/operation'),
    rollback: post<never, RollbackAccepted>('/repository/:id/rollback/:deploymentId'),
    storageExplore: get<ContainerEntry[]>('/repository/:id/storage/*'),
    storageExploreRoot: get<ContainerEntry[]>('/repository/:id/storage'),
    storageRead: get<ContainerFile>('/repository/:id/storage/read'),
    storageWrite: post<StorageWriteInput>('/repository/:id/storage/write'),
    webhook: post<never, WebhookOutcome>('/repository/webhook/:repositoryId')
};
