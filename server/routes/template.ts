import express from 'express';
import * as templateController from '@controllers/template';
import * as authMiddleware from '@middlewares/authentication';
import { resolveTenant, resolveTenantDiscovery, requirePermission } from '@middlewares/tenancy';
import validate from '@middlewares/validation';
import {
    CreateTemplateSchema,
    InstallTemplateSchema,
    IdParamsSchema,
    OrgIdParamsSchema,
    ProjectIdParamsSchema
} from '@middlewares/validators';

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/', resolveTenantDiscovery, templateController.getTemplates);
router.get('/categories', resolveTenantDiscovery, templateController.getCategories);

router.post(
    '/organization/:orgId',
    validate(OrgIdParamsSchema, 'params'),
    resolveTenant,
    requirePermission('project:write'),
    validate(CreateTemplateSchema),
    templateController.createTemplate
);

router.post(
    '/project/:projectId/install',
    validate(ProjectIdParamsSchema, 'params'),
    resolveTenant,
    requirePermission('deploy'),
    validate(InstallTemplateSchema),
    templateController.installTemplate
);

router.get('/:id', validate(IdParamsSchema, 'params'), resolveTenantDiscovery, templateController.getTemplate);
router.delete('/:id', validate(IdParamsSchema, 'params'), resolveTenant, requirePermission('project:write'), templateController.deleteTemplate);

export default router;
