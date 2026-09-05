import type { DeploymentErrorCode } from '@quantum/contracts/modules/deployment/errors';
import type { RepositoryErrorCode } from '@quantum/contracts/modules/repository/errors';
import { forbidden, notFound } from '@/shared/utils/error-messages';

export const repositoryErrorMessages: Partial<Record<RepositoryErrorCode, string>> = {
    'Repository::NotFound': notFound('repository', 'This'),
    'Repository::Forbidden': forbidden('repository', 'this'),
    'Repository::AliasAlreadyTaken': 'That alias is already used by another repository.',
    'Repository::InvalidSignature': 'The webhook signature is not valid.',
    'Repository::OperationFailed': 'The operation could not be completed. Try again.'
};

export const deploymentErrorMessages: Partial<Record<DeploymentErrorCode, string>> = {
    'Deployment::NotFound': notFound('deployment', 'This'),
    'Deployment::Forbidden': forbidden('deployment', 'this'),
    'Deployment::OperationFailed': 'The operation could not be completed. Try again.'
};

export const repositoryDetailErrorMessages = {
    ...repositoryErrorMessages,
    ...deploymentErrorMessages
};
