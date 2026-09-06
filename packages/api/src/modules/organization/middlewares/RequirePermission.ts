import { MiddlewareFn } from '@/shared/middlewares/Middleware';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import { TenancyError } from '../contracts/domain/errors';

export type TenantAction =
    | 'read'
    | 'deploy'
    | 'repo:write'
    | 'project:write'
    | 'project:delete'
    | 'member:manage'
    | 'token:manage'
    | 'registry:manage'
    | 'org:settings'
    | 'org:delete';

const PERMISSIONS: Record<OrganizationRole, Set<TenantAction>> = {
    [OrganizationRole.Owner]: new Set<TenantAction>(['read', 'deploy', 'repo:write', 'project:write', 'project:delete', 'member:manage', 'token:manage', 'registry:manage', 'org:settings', 'org:delete']),
    [OrganizationRole.Admin]: new Set<TenantAction>(['read', 'deploy', 'repo:write', 'project:write', 'project:delete', 'member:manage', 'token:manage', 'registry:manage']),
    [OrganizationRole.Member]: new Set<TenantAction>(['read', 'deploy', 'repo:write']),
    [OrganizationRole.Viewer]: new Set<TenantAction>(['read'])
};

export const RequirePermission = (action: TenantAction): MiddlewareFn => (req) => {
    const tenant = req.tenant;
    if(tenant?.isPlatformAdmin) return;
    if(!tenant || !PERMISSIONS[tenant.role].has(action)){
        throw TenancyError.InsufficientPermissions();
    }
};
