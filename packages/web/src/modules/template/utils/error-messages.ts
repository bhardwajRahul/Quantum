import type { TemplateErrorCode, TemplateInstallErrorCode } from '@quantum/contracts/modules/template/errors';
import { forbidden, notFound } from '@/shared/utils/error-messages';

export const templateErrorMessages: Partial<Record<TemplateErrorCode | TemplateInstallErrorCode, string>> = {
    'Template::NotFound': notFound('template'),
    'Template::Forbidden': forbidden('template'),
    'Template::SlugAlreadyTaken': 'That slug is already taken.',
    'TemplateInstall::NotFound': notFound('installation'),
    'TemplateInstall::Forbidden': forbidden('installation'),
    'TemplateInstall::MissingInput': 'A required input is missing.',
    'TemplateInstall::InvalidCompose': 'The compose file is not valid.',
    'TemplateInstall::UnsupportedCompose': 'The compose file uses something Quantum cannot deploy.',
    'TemplateInstall::NotCompose': 'This installation was not created from a compose file.',
    'TemplateInstall::UnknownService': 'That service is not part of this installation.'
};
