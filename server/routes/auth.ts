/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
 *
 * =+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 *
 * For related information - https://github.com/rodyherrera/Quantum/
 *
 * All your applications, just in one place. 
 *
 * =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
****/

import express from 'express';
import * as authenticationController from '@controllers/authentication';
import * as authenticationMiddleware from '@middlewares/authentication';
import rateLimiter from '@middlewares/rateLimiter';

const router = express.Router();

router.post('/sign-in', rateLimiter, authenticationController.signIn);
router.post('/sign-up', rateLimiter, authenticationController.signUp);

router.use(authenticationMiddleware.protect);
router.get('/me/logout/', authenticationController.logout);
router.patch('/me/update/password/', authenticationController.updateMyPassword);

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
