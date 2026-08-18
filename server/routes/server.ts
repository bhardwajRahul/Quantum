import express from 'express';
import * as serverController from '@controllers/server';
import * as authMiddleware from '@middlewares/authentication';

const router = express.Router();

router.get('/health', serverController.health);
router.use(authMiddleware.protect);
router.get('/ip/', serverController.getServerIP)

export default router;
