import type { TenancyErrorCode } from '@quantum/contracts/modules/organization/errors';

export const tenancyErrorMessages: Partial<Record<TenancyErrorCode, string>> = {
    'Tenancy::OrganizationNotFound': 'That organization no longer exists.',
    'Tenancy::OrganizationForbidden': 'You do not have access to that organization.',
    'Tenancy::OrganizationReconfigure': 'Your organization selection is out of date. Pick one of your organizations.',
    'Tenancy::ContextMissing': 'Pick an organization to continue.',
    'Tenancy::InsufficientPermissions': 'You do not have permission to do this.',
    'Tenancy::MembershipNotFound': 'That membership no longer exists.',
    'Tenancy::MembershipAlreadyExists': 'That user is already a member of this organization.',
    'Tenancy::MemberNotFound': 'That member no longer exists.',
    'Tenancy::CannotRemoveOwner': 'The organization owner cannot be removed.',
    'Tenancy::CannotDemoteOwner': 'The owner role cannot be changed.',
    'Tenancy::UserNotFound': 'No Quantum user exists with that email.'
};
