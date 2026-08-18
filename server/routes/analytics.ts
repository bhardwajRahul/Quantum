import express from 'express';
import * as analyticsController from '@controllers/analytics';
import * as authMiddleware from '@middlewares/authentication';
import { resolveTenant } from '@middlewares/tenancy';

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/summary', resolveTenant, analyticsController.getSummary);
router.get('/top', resolveTenant, analyticsController.getTop);
router.get('/domains', resolveTenant, analyticsController.getDomains);

export default router;
