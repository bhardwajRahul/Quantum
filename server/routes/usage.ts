import express from 'express';
import * as usageController from '@controllers/usage';
import * as authMiddleware from '@middlewares/authentication';
import { resolveTenant } from '@middlewares/tenancy';

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/network', resolveTenant, usageController.getNetwork);
router.get('/resources', resolveTenant, usageController.getResources);

export default router;
