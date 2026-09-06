import type { ProjectErrorCode } from '@quantum/contracts/modules/project/errors';
import { forbidden, notFound } from '@/shared/utils/error-messages';

export const projectErrorMessages: Partial<Record<ProjectErrorCode, string>> = {
    'Project::NotFound': notFound('project'),
    'Project::Forbidden': forbidden('project'),
    'Project::SlugAlreadyTaken': 'A project with that identifier already exists.'
};
