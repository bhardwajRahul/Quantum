import express from 'express';
import * as environmentController from '@controllers/environment';
import * as authMiddleware from '@middlewares/authentication';
import { resolveTenant, requirePermission } from '@middlewares/tenancy';
import validate from '@middlewares/validation';
import { CreateEnvironmentSchema, IdParamsSchema, ProjectIdParamsSchema } from '@middlewares/validators';

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/project/:projectId', validate(ProjectIdParamsSchema, 'params'), resolveTenant, environmentController.getEnvironments);
router.post('/project/:projectId', validate(ProjectIdParamsSchema, 'params'), resolveTenant, requirePermission('project:write'), environmentController.createEnvironment);

router.get('/:id', validate(IdParamsSchema, 'params'), resolveTenant, environmentController.getEnvironment);
router.patch('/:id', validate(IdParamsSchema, 'params'), resolveTenant, requirePermission('project:write'), environmentController.updateEnvironment);
router.delete('/:id', validate(IdParamsSchema, 'params'), resolveTenant, requirePermission('project:write'), environmentController.deleteEnvironment);

export default router;
