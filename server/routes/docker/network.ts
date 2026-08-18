import express from 'express';
import * as dockerNetworkController from '@controllers/docker/network';
import * as authMiddleware from '@middlewares/authentication';
import { resolveTenant } from '@middlewares/tenancy';
import DockerNetwork from '@models/docker/network';
import { verifyOwnership } from '@middlewares/common';

const router = express.Router();
const ownership = verifyOwnership(DockerNetwork);

router.use(authMiddleware.protect, resolveTenant);
router.get('/me/', dockerNetworkController.getMyDockersNetwork);
router.post('/', dockerNetworkController.createDockerNetwork);

router.route('/:id')
    .get(ownership, dockerNetworkController.getDockerNetwork)
    .patch(ownership, dockerNetworkController.updateDockerNetwork)
    .delete(ownership, dockerNetworkController.deleteDockerNetwork);

const adminRouter = express.Router();
adminRouter.use(authMiddleware.restrictTo('admin'));
adminRouter.get('/', dockerNetworkController.getDockerNetworks);
router.use(adminRouter);

export default router;