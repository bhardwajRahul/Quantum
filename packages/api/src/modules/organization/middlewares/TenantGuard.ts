import { MiddlewareFn } from '@/shared/middlewares/Middleware';
import { AuthenticatedRoute } from '@/modules/auth/middlewares/AuthenticatedRoute';
import { RequirePermission } from './RequirePermission';
import { TenantRoute } from './TenantRoute';
import type { TenantAction } from './RequirePermission';

export const TenantGuard = (action?: TenantAction): MiddlewareFn => async (req, reply) => {
    await AuthenticatedRoute(req, reply);
    await TenantRoute(req, reply);
    if(action !== undefined) await RequirePermission(action)(req, reply);
};
