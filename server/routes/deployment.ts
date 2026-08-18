import express from 'express';
import * as deploymentController from '@controllers/deployment';
import * as authMiddleware from '@middlewares/authentication';
import { resolveTenant } from '@middlewares/tenancy';
import * as githubMiddleware from '@middlewares/github';
import Deployment from '@models/deployment';
import { verifyOwnership } from '@middlewares/common';
import validate from '@middlewares/validation';
import { RepositoryOperationSchema } from '@middlewares/validators';

const router = express.Router();
const ownership = verifyOwnership(Deployment);

router.use(authMiddleware.protect, resolveTenant);

router.get('/repository/:repositoryName/',
    githubMiddleware.populateGithubAccount,
    deploymentController.getRepositoryDeployments);

router.get('/repository/:repositoryAlias/environment/',
    githubMiddleware.populateGithubAccount,
    deploymentController.getActiveDeploymentEnvironment);

router.delete('/repository/:repositoryName/:deploymentId',
    githubMiddleware.populateGithubAccount,
    deploymentController.deleteGithubDeployment);

router.post('/repository/:repositoryAlias/actions/',
    validate(RepositoryOperationSchema),
    deploymentController.repositoryOperations);

router.route('/:id')
    .get(ownership, deploymentController.getDeployment)
    .patch(ownership, deploymentController.updateDeployment)
    .delete(ownership, deploymentController.deleteDeployment);

const adminRouter = express.Router();
adminRouter.use(authMiddleware.restrictTo('admin'));
adminRouter.get('/', deploymentController.getDeployments);
router.use(adminRouter);

export default router;
