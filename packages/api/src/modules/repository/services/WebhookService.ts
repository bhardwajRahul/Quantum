import crypto from 'node:crypto';
import { config } from '@/shared/config';
import { eventBus } from '@/shared/events/EventBus';
import Repository from '../models/Repository';
import { RepositoryError } from '../contracts/domain/errors';
import type { WebhookOutcome } from '@quantum/contracts/modules/repository/domain';

interface PushEvent{
    ref?: string;
    after?: string;
    head_commit?: { id?: string };
}

export interface WebhookDecision{
    status: 200 | 202;
    outcome: WebhookOutcome;
}

const isValidSignature = (signature: string | undefined, rawBody: Buffer | undefined): boolean => {
    if(signature === undefined || rawBody === undefined) return false;
    const expected = 'sha256=' + crypto.createHmac('sha256', config.jwtSecret).update(rawBody).digest('hex');
    const received = Buffer.from(signature);
    const computed = Buffer.from(expected);
    return received.length === computed.length && crypto.timingSafeEqual(received, computed);
};

const isPushEvent = (payload: unknown): payload is PushEvent =>
    typeof payload === 'object' && payload !== null && 'pusher' in payload;

export default class WebhookService{
    async handle(
        repositoryId: number,
        signature: string | undefined,
        rawBody: Buffer | undefined,
        payload: unknown
    ): Promise<WebhookDecision>{
        if(!isValidSignature(signature, rawBody)) throw RepositoryError.InvalidSignature();
        if(!isPushEvent(payload)) return { status: 200, outcome: { ok: true } };

        const repository = await Repository.findOneBy({ id: repositoryId });
        if(!repository) throw RepositoryError.NotFound();

        const pushedRef = payload.ref ?? '';
        if(pushedRef !== '' && pushedRef !== `refs/heads/${repository.branch}`){
            return { status: 200, outcome: { skipped: true, reason: 'branch-mismatch' } };
        }

        eventBus.emit('deployment.requested', {
            repositoryId: repository.id,
            reason: 'push',
            commit: payload.after || payload.head_commit?.id || null,
            userId: repository.userId
        });
        return { status: 202, outcome: { skipped: false } };
    }
}
