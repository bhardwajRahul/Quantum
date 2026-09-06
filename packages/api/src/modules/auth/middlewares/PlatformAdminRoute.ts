import { MiddlewareFn } from '@/shared/middlewares/Middleware';
import { AuthError } from '../contracts/domain/errors';
import { UserRole } from '@quantum/contracts/modules/user/domain';
import User from '@/modules/user/models/User';

export const PlatformAdminRoute: MiddlewareFn = async (req) => {
    if(!req.principal) throw AuthError.Unauthorized();

    const user = await User.findOneBy({ id: req.principal.userId });
    if(!user || user.role !== UserRole.Admin) throw AuthError.Forbidden();
};
