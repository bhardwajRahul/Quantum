import express from 'express';
import * as databaseController from '@controllers/database';
import * as authMiddleware from '@middlewares/authentication';
import { resolveTenant, requirePermission } from '@middlewares/tenancy';
import validate from '@middlewares/validation';
import { CreateDatabaseSchema, IdParamsSchema, ProjectIdParamsSchema } from '@middlewares/validators';

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/project/:projectId', validate(ProjectIdParamsSchema, 'params'), resolveTenant, databaseController.getDatabases);
router.post('/project/:projectId', validate(ProjectIdParamsSchema, 'params'), resolveTenant, requirePermission('project:write'), validate(CreateDatabaseSchema), databaseController.createDatabase);

router.post('/:id/backup', validate(IdParamsSchema, 'params'), resolveTenant, requirePermission('deploy'), databaseController.backupDatabase);
router.post('/:id/restore', validate(IdParamsSchema, 'params'), resolveTenant, requirePermission('deploy'), databaseController.restoreDatabase);

router.get('/:id/connection-string', validate(IdParamsSchema, 'params'), resolveTenant, requirePermission('deploy'), databaseController.getConnectionString);

router.get('/:id', validate(IdParamsSchema, 'params'), resolveTenant, databaseController.getDatabase);
router.delete('/:id', validate(IdParamsSchema, 'params'), resolveTenant, requirePermission('deploy'), databaseController.deleteDatabase);

export default router;
