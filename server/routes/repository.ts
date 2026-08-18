import express from 'express';
import * as repositoryController from '@controllers/repository';
import * as authMiddleware from '@middlewares/authentication';
import { resolveTenant } from '@middlewares/tenancy';
import * as githubMiddleware from '@middlewares/github';
import { verifyOwnership } from '@middlewares/common';
import validate from '@middlewares/validation';
import { CreateRepositorySchema } from '@middlewares/validators';
import Repository from '@models/repository';
import DockerFS from '@controllers/common/dockerFS';

const router = express.Router();
const repositoryFS = new DockerFS();
const ownership = verifyOwnership(Repository);

router.use(authMiddleware.protect, resolveTenant);

router.get('/me/github/',
    githubMiddleware.populateRepositories,
    githubMiddleware.populateGithubAccount,
    repositoryController.getMyGithubRepositories);

router.get('/me/github/:owner/:repo/detect',
    githubMiddleware.populateGithubAccount,
    repositoryController.detectFramework);

router.get('/me/',
    githubMiddleware.populateRepositories,
    githubMiddleware.populateGithubAccount,
    repositoryController.getMyRepositories);

router.post('/', validate(CreateRepositorySchema), repositoryController.createRepository);

router.post('/:id/rollback/:deploymentId', ownership, repositoryController.rollbackRepository);

router.get('/storage/:id/explore/:route?', ownership, repositoryFS.storageExplorer);
router.get('/storage/:id/read/:route?', ownership, repositoryFS.readContainerFile);
router.post('/storage/:id/overwrite/:route?', ownership, repositoryFS.updateContainerFile);

router.route('/:id')
    .get(ownership, repositoryController.getRepository)
    .patch(ownership, repositoryController.updateRepository)
    .delete(ownership, repositoryController.deleteRepository);

router.use(authMiddleware.restrictTo('admin'));
router.get('/', repositoryController.getRepositories);

export default router;
