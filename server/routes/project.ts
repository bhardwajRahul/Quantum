import express from 'express';
import * as projectController from '@controllers/project';
import * as authMiddleware from '@middlewares/authentication';
import { resolveTenant, requirePermission } from '@middlewares/tenancy';
import validate from '@middlewares/validation';
import { CreateProjectSchema, IdParamsSchema, OrgIdParamsSchema } from '@middlewares/validators';

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/organization/:orgId', validate(OrgIdParamsSchema, 'params'), resolveTenant, projectController.getProjects);
router.post('/organization/:orgId', validate(OrgIdParamsSchema, 'params'), resolveTenant, requirePermission('project:write'), projectController.createProject);

router.get('/:id', validate(IdParamsSchema, 'params'), resolveTenant, projectController.getProject);
router.patch('/:id', validate(IdParamsSchema, 'params'), resolveTenant, requirePermission('project:write'), projectController.updateProject);
router.delete('/:id', validate(IdParamsSchema, 'params'), resolveTenant, requirePermission('project:delete'), projectController.deleteProject);

export default router;
