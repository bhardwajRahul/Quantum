import type { TenancyErrorCode } from '@quantum/contracts/modules/organization/errors';
import { forbidden, notFound } from '@/shared/utils/error-messages';

export const tenancyErrorMessages: Partial<Record<TenancyErrorCode, string>> = {
    'Tenancy::OrganizationNotFound': notFound('organization'),
    'Tenancy::OrganizationForbidden': forbidden('organization'),
    'Tenancy::OrganizationReconfigure': 'Your organization selection is out of date. Pick one of your organizations.',
    'Tenancy::ContextMissing': 'Pick an organization to continue.',
    'Tenancy::InsufficientPermissions': 'You do not have permission to do this.',
    'Tenancy::MembershipNotFound': notFound('membership'),
    'Tenancy::MembershipAlreadyExists': 'That user is already a member of this organization.',
    'Tenancy::MemberNotFound': notFound('member'),
    'Tenancy::CannotRemoveOwner': 'The organization owner cannot be removed.',
    'Tenancy::CannotDemoteOwner': 'The owner role cannot be changed.',
    'Tenancy::UserNotFound': 'No Quantum user exists with that email.'
};
