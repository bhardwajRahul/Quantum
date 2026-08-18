import express from 'express';
import * as organizationController from '@controllers/organization';
import * as authMiddleware from '@middlewares/authentication';
import { resolveTenant, resolveTenantDiscovery, requirePermission } from '@middlewares/tenancy';
import validate from '@middlewares/validation';
import { CreateOrganizationSchema, IdParamsSchema } from '@middlewares/validators';

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/', resolveTenantDiscovery, organizationController.getOrganizations);
router.post('/', resolveTenantDiscovery, validate(CreateOrganizationSchema), organizationController.createOrganization);
router.get('/:id', resolveTenant, validate(IdParamsSchema, 'params'), organizationController.getOrganization);
router.patch('/:id', resolveTenant, validate(IdParamsSchema, 'params'), requirePermission('org:settings'), organizationController.updateOrganization);
router.delete('/:id', resolveTenant, validate(IdParamsSchema, 'params'), requirePermission('org:delete'), organizationController.deleteOrganization);

export default router;
