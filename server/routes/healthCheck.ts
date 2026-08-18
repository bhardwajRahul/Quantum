import express from 'express';
import * as healthCheckController from '@controllers/healthCheck';
import * as authMiddleware from '@middlewares/authentication';
import { resolveTenant, requirePermission } from '@middlewares/tenancy';
import validate from '@middlewares/validation';
import { CreateHealthCheckSchema, IdParamsSchema, RepositoryIdParamsSchema } from '@middlewares/validators';

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/repository/:repositoryId', validate(RepositoryIdParamsSchema, 'params'), resolveTenant, healthCheckController.getHealthChecks);
router.post('/repository/:repositoryId', validate(RepositoryIdParamsSchema, 'params'), resolveTenant, requirePermission('repo:write'), validate(CreateHealthCheckSchema), healthCheckController.createHealthCheck);

router.get('/:id', validate(IdParamsSchema, 'params'), resolveTenant, healthCheckController.getHealthCheck);
router.patch('/:id', validate(IdParamsSchema, 'params'), resolveTenant, requirePermission('repo:write'), healthCheckController.updateHealthCheck);
router.delete('/:id', validate(IdParamsSchema, 'params'), resolveTenant, requirePermission('repo:write'), healthCheckController.deleteHealthCheck);

export default router;
