import express from 'express';
import * as portBindingController from '@controllers/portBinding';
import * as authMiddleware from '@middlewares/authentication';
import { resolveTenant } from '@middlewares/tenancy';
import PortBinding from '@models/portBinding';
import { verifyOwnership } from '@middlewares/common';

const router = express.Router();
const ownership = verifyOwnership(PortBinding);

router.use(authMiddleware.protect, resolveTenant);
router.get('/me/', portBindingController.getMyPortBindings);
router.post('/', portBindingController.createPortBinding);

router.route('/:id')
    .get(ownership, portBindingController.getPortBinding)
    .patch(ownership, portBindingController.updatePortBinding)
    .delete(ownership, portBindingController.deletePortBinding);

const adminRouter = express.Router();
adminRouter.use(authMiddleware.restrictTo('admin'));
adminRouter.get('/', portBindingController.getPortBindings);
router.use(adminRouter);

export default router;