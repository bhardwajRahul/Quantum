import express from 'express';
import * as metricController from '@controllers/metric';
import * as authMiddleware from '@middlewares/authentication';
import { resolveTenant } from '@middlewares/tenancy';
import validate from '@middlewares/validation';
import { RepositoryIdParamsSchema } from '@middlewares/validators';
import { z } from 'zod';

const router = express.Router();

router.use(authMiddleware.protect);

const ContainerIdParamsSchema = z.object({
    containerId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'must be a valid id')
});

router.get('/container/:containerId', validate(ContainerIdParamsSchema, 'params'), resolveTenant, metricController.getContainerMetrics);
router.get('/repository/:repositoryId', validate(RepositoryIdParamsSchema, 'params'), resolveTenant, metricController.getRepositoryMetrics);

export default router;
