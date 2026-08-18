import express from 'express';
import * as authenticationController from '@controllers/authentication';
import * as authenticationMiddleware from '@middlewares/authentication';
import { resolveTenantDiscovery } from '@middlewares/tenancy';
import rateLimiter from '@middlewares/rateLimiter';
import validate from '@middlewares/validation';
import { SignInSchema, SignUpSchema, UpdatePasswordSchema } from '@middlewares/validators';

const router = express.Router();

router.post('/sign-in', rateLimiter, validate(SignInSchema), authenticationController.signIn);
router.post('/sign-up', rateLimiter, validate(SignUpSchema), authenticationController.signUp);

router.use(authenticationMiddleware.protect, resolveTenantDiscovery);
router.get('/me/logout/', authenticationController.logout);
router.patch('/me/update/password/', validate(UpdatePasswordSchema), authenticationController.updateMyPassword);

router.route('/me')
    .get(authenticationController.getMyAccount)
    .patch(authenticationController.updateMyAccount)
    .delete(authenticationController.deleteMyAccount);

router.use(authenticationMiddleware.restrictTo('admin'));

router.route('/:id')
    .get(authenticationController.getUser)
    .patch(authenticationController.updateUser)
    .delete(authenticationController.deleteUser);

router.route('/')
    .get(authenticationController.getAllUsers)
    .post(authenticationController.createUser);

export default router;
