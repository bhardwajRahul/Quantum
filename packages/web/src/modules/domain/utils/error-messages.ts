import type { DomainErrorCode } from '@quantum/contracts/modules/domain/errors';
import { forbidden, notFound } from '@/shared/utils/error-messages';

export const domainErrorMessages: Partial<Record<DomainErrorCode, string>> = {
    'Domain::NotFound': notFound('domain'),
    'Domain::Forbidden': forbidden('domain'),
    'Domain::AlreadyExists': 'That host is already bound to a repository.'
};
