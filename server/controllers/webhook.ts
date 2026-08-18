import Repository from '@models/repository';
import crypto from 'crypto';
import RuntimeError from '@utilities/runtimeError';
import logger from '@utilities/logger';
import { enqueueDeploy } from '@services/orchestrator';
import { Request, Response } from 'express';

const verifySignature = (req: Request): boolean => {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const rawBody = (req as any).rawBody as Buffer | undefined;
    const secret = process.env.SECRET_KEY;

    if(!secret || !signature || !rawBody) return false;
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const received = Buffer.from(signature);
    const computed = Buffer.from(expected);
    return received.length === computed.length && crypto.timingSafeEqual(received, computed);
};

export const webhook = async (req: Request, res: Response) => {
    try{
        if(!verifySignature(req)){
            return res.status(401).json({ status: 'error', message: 'Invalid signature' });
        }

        if(!req.body.pusher){
            return res.status(200).json({ status: 'success' });
        }

        const repositoryId = req.params.repositoryId;

        const repository = await Repository.findById(repositoryId).select('user branch');
        if(!repository) throw new RuntimeError('Repository::Not::Found', 404);

        const trackedBranch = (repository as any).branch || 'main';
        const pushedRef = req.body.ref || '';
        if(pushedRef && pushedRef !== `refs/heads/${trackedBranch}`){
            return res.status(200).json({ status: 'success', data: { skipped: true, reason: 'branch-mismatch' } });
        }

        const commit = req.body.after || req.body.head_commit?.id;
        const job = await enqueueDeploy(repositoryId, {
            reason: 'push',
            commit,
            userId: repository.user?.toString()
        });

        res.status(202).json({ status: 'success', data: { jobId: job._id.toString(), status: job.status } });
    }catch(error: any){
        logger.error('@controllers/webhook.ts: ' + error.message);
        const statusCode = error instanceof RuntimeError ? error.statusCode : 500;
        res.status(statusCode).json({ status: 'error', message: error.message });
    }
};
