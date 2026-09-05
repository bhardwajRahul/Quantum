import type { EnvironmentErrorCode, ProjectErrorCode } from '@quantum/contracts/modules/project/errors';
import { forbidden, notFound } from '@/shared/utils/error-messages';

export const projectErrorMessages: Partial<Record<ProjectErrorCode | EnvironmentErrorCode, string>> = {
    'Project::NotFound': notFound('project'),
    'Project::Forbidden': forbidden('project'),
    'Project::SlugAlreadyTaken': 'A project with that identifier already exists.',
    'Environment::NotFound': notFound('environment'),
    'Environment::NameAlreadyTaken': 'An environment with that name already exists.'
};
