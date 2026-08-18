import express from 'express';
import * as membershipController from '@controllers/membership';
import * as authMiddleware from '@middlewares/authentication';
import { resolveTenant, requirePermission } from '@middlewares/tenancy';
import validate from '@middlewares/validation';
import { InviteMemberSchema, OrgIdParamsSchema, OrgMemberParamsSchema } from '@middlewares/validators';

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/organization/:orgId/members', validate(OrgIdParamsSchema, 'params'), resolveTenant, membershipController.getMembers);
router.post('/organization/:orgId/members', validate(OrgIdParamsSchema, 'params'), resolveTenant, requirePermission('member:manage'), membershipController.inviteMember);
router.patch('/organization/:orgId/members/:id', validate(OrgMemberParamsSchema, 'params'), resolveTenant, requirePermission('member:manage'), membershipController.updateMember);
router.delete('/organization/:orgId/members/:id', validate(OrgMemberParamsSchema, 'params'), resolveTenant, requirePermission('member:manage'), membershipController.removeMember);

export default router;
