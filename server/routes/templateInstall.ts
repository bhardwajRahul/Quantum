import express from 'express';
import * as templateInstallController from '@controllers/templateInstall';
import * as authMiddleware from '@middlewares/authentication';
import { resolveTenant, requirePermission } from '@middlewares/tenancy';
import validate from '@middlewares/validation';
import { IdParamsSchema, ProjectIdParamsSchema } from '@middlewares/validators';

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/project/:projectId', validate(ProjectIdParamsSchema, 'params'), resolveTenant, templateInstallController.getTemplateInstalls);

router.get('/:id', validate(IdParamsSchema, 'params'), resolveTenant, templateInstallController.getTemplateInstall);

router.delete('/:id', validate(IdParamsSchema, 'params'), resolveTenant, requirePermission('deploy'), templateInstallController.deleteTemplateInstall);

export default router;
