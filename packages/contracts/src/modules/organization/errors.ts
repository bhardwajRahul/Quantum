import type { ErrorCode, ErrorTable } from '../../shared/errors';

export const TenancyErrors = {
    domain: 'Tenancy',
    causes: {
        OrganizationNotFound: 404,
        OrganizationForbidden: 403,
        OrganizationReconfigure: 409,
        ProjectNotFound: 404,
        ProjectForbidden: 403,
        ContextMissing: 401,
        InsufficientPermissions: 403,
        MembershipNotFound: 404,
        MembershipAlreadyExists: 409,
        MemberNotFound: 404,
        CannotRemoveOwner: 400,
        CannotDemoteOwner: 400,
        UserNotFound: 404
    }
} as const satisfies ErrorTable;

export type TenancyErrorCode = ErrorCode<typeof TenancyErrors>;
