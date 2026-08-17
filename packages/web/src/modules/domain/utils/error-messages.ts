import type { DomainErrorCode } from '@quantum/contracts/modules/domain/errors';

export const domainErrorMessages: Partial<Record<DomainErrorCode, string>> = {
    'Domain::NotFound': 'That domain no longer exists.',
    'Domain::Forbidden': 'You do not have access to that domain.',
    'Domain::AlreadyExists': 'That host is already bound to a repository.'
};
