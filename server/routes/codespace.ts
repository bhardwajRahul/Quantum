import express from 'express';
import * as codespaceController from '@controllers/codespace';
import * as authMiddleware from '@middlewares/authentication';
import { resolveTenant, requirePermission } from '@middlewares/tenancy';
import validate from '@middlewares/validation';
import { IdParamsSchema, ProjectIdParamsSchema } from '@middlewares/validators';

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/project/:projectId', validate(ProjectIdParamsSchema, 'params'), resolveTenant, codespaceController.getCodespaces);
router.post('/project/:projectId', validate(ProjectIdParamsSchema, 'params'), resolveTenant, requirePermission('deploy'), codespaceController.createCodespace);

router.get('/:id/access', validate(IdParamsSchema, 'params'), resolveTenant, requirePermission('deploy'), codespaceController.getAccess);

router.get('/:id', validate(IdParamsSchema, 'params'), resolveTenant, codespaceController.getCodespace);
router.delete('/:id', validate(IdParamsSchema, 'params'), resolveTenant, requirePermission('deploy'), codespaceController.deleteCodespace);

export default router;
