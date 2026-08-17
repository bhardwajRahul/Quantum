import type { EnvironmentErrorCode, ProjectErrorCode } from '@quantum/contracts/modules/project/errors';

export const projectErrorMessages: Partial<Record<ProjectErrorCode | EnvironmentErrorCode, string>> = {
    'Project::NotFound': 'That project no longer exists.',
    'Project::Forbidden': 'You do not have access to that project.',
    'Project::SlugAlreadyTaken': 'A project with that identifier already exists.',
    'Project::NameAlreadyTaken': 'A project with that name already exists.',
    'Environment::NotFound': 'That environment no longer exists.',
    'Environment::Forbidden': 'You do not have access to that environment.',
    'Environment::NameAlreadyTaken': 'An environment with that name already exists.'
};
