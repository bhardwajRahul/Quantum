import express from 'express';
import * as githubController from '@controllers/github';
import * as githubMiddleware from '@middlewares/github';
import * as authMiddleware from '@middlewares/authentication';
import { resolveTenant } from '@middlewares/tenancy';

const router = express.Router();

router.get('/authenticate/', githubMiddleware.authenticate);
router.get('/callback/',
    githubMiddleware.authenticateCallback,
    githubController.authCallback);

router.use(authMiddleware.protect, resolveTenant);
router.post('/', githubController.createAccount);

router.use(authMiddleware.restrictTo('admin'));
router.route('/:id')
    .get(githubController.getAccount)
    .patch(githubController.updateAccount)
    .delete(githubController.deleteAccount);

router.route('/')
    .get(githubController.getAccounts);

export default router;
