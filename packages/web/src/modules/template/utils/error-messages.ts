import type { TemplateErrorCode, TemplateInstallErrorCode } from '@quantum/contracts/modules/template/errors';

export const templateErrorMessages: Partial<Record<TemplateErrorCode | TemplateInstallErrorCode, string>> = {
    'Template::NotFound': 'That template no longer exists.',
    'Template::Forbidden': 'You do not have access to that template.',
    'Template::SlugAlreadyTaken': 'That slug is already taken.',
    'TemplateInstall::NotFound': 'That installation no longer exists.',
    'TemplateInstall::Forbidden': 'You do not have access to that installation.',
    'TemplateInstall::MissingInput': 'A required input is missing.'
};
