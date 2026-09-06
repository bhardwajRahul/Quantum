import { del, get, patch, post } from '../../shared/routing';
import type { CreateRepositoryInput, UpdateRepositoryInput } from './http';
import type { Repository, RollbackAccepted, WebhookOutcome } from './domain';

export const repositoryRoutes = {
    mine: get<Repository[]>('/repository/me'),
    create: post<CreateRepositoryInput, Repository>('/repository'),
    get: get<Repository>('/repository/:id'),
    update: patch<UpdateRepositoryInput, Repository>('/repository/:id'),
    remove: del('/repository/:id'),
    rollback: post<never, RollbackAccepted>('/repository/:id/rollback/:deploymentId'),
    webhook: post<never, WebhookOutcome>('/repository/webhook/:repositoryId')
};
