import express from 'express';
import * as dockerImageController from '@controllers/docker/image';
import * as authMiddleware from '@middlewares/authentication';
import { resolveTenant } from '@middlewares/tenancy';
import DockerImage from '@models/docker/image';
import { verifyOwnership } from '@middlewares/common';

const router = express.Router();
const ownership = verifyOwnership(DockerImage);

router.use(authMiddleware.protect, resolveTenant);
router.get('/me/', dockerImageController.getMyDockersImage);
router.post('/', dockerImageController.createDockerImage);

router.route('/:id')
    .get(ownership, dockerImageController.getDockerImage)
    .patch(ownership, dockerImageController.updateDockerImage)
    .delete(ownership, dockerImageController.deleteDockerImage);

const adminRouter = express.Router();
adminRouter.use(authMiddleware.restrictTo('admin'));
adminRouter.get('/', dockerImageController.getDockerImages);
router.use(adminRouter);

export default router;