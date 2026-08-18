import express from 'express';
import * as activityController from '@controllers/activity';
import * as authMiddleware from '@middlewares/authentication';
import { resolveTenant } from '@middlewares/tenancy';

const router = express.Router();

router.use(authMiddleware.protect);
router.get('/', resolveTenant, activityController.getActivity);

export default router;
