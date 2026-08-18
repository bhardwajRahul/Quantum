import express from 'express';
import * as domainController from '@controllers/domain';
import * as authMiddleware from '@middlewares/authentication';
import { resolveTenant, requirePermission } from '@middlewares/tenancy';
import validate from '@middlewares/validation';
import { CreateDomainSchema, IdParamsSchema, RepositoryIdParamsSchema } from '@middlewares/validators';

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/repository/:repositoryId', validate(RepositoryIdParamsSchema, 'params'), resolveTenant, domainController.getDomains);
router.post('/repository/:repositoryId', validate(RepositoryIdParamsSchema, 'params'), resolveTenant, requirePermission('repo:write'), validate(CreateDomainSchema), domainController.createDomain);

router.get('/:id', validate(IdParamsSchema, 'params'), resolveTenant, domainController.getDomain);
router.patch('/:id', validate(IdParamsSchema, 'params'), resolveTenant, requirePermission('repo:write'), domainController.updateDomain);
router.delete('/:id', validate(IdParamsSchema, 'params'), resolveTenant, requirePermission('repo:write'), domainController.deleteDomain);

export default router;
