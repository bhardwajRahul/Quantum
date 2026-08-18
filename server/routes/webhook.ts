import express from 'express';
import * as webhookController from '@controllers/webhook';
import validate from '@middlewares/validation';
import { WebhookParamsSchema } from '@middlewares/validators';

const router = express.Router();

router.post('/:repositoryId/', validate(WebhookParamsSchema, 'params'), webhookController.webhook);

export default router;
