import type { DeploymentErrorCode } from '@quantum/contracts/modules/deployment/errors';
import type { RepositoryErrorCode } from '@quantum/contracts/modules/repository/errors';

export const repositoryErrorMessages: Partial<Record<RepositoryErrorCode, string>> = {
    'Repository::NotFound': 'This repository no longer exists.',
    'Repository::Forbidden': 'You do not have access to this repository.',
    'Repository::AliasAlreadyTaken': 'That alias is already used by another repository.',
    'Repository::InvalidSignature': 'The webhook signature is not valid.',
    'Repository::OperationFailed': 'The operation could not be completed. Try again.'
};

export const deploymentErrorMessages: Partial<Record<DeploymentErrorCode, string>> = {
    'Deployment::NotFound': 'This deployment no longer exists.',
    'Deployment::Forbidden': 'You do not have access to this deployment.',
    'Deployment::OperationFailed': 'The operation could not be completed. Try again.',
    'Deployment::BuildFailed': 'The build failed. Check the deployment logs.'
};

export const repositoryDetailErrorMessages = {
    ...repositoryErrorMessages,
    ...deploymentErrorMessages
};
