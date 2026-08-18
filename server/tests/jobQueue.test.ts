import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { MongoJobQueue } from '@services/queue/jobQueue';
import Job from '@models/job';
import { setupMemoryMongo } from '@tests/helpers/memoryMongo';

setupMemoryMongo();

const queue = new MongoJobQueue();
const oid = () => new mongoose.Types.ObjectId();

describe('MongoJobQueue', () => {
    it('enqueues a job in queued state', async () => {
        const repo = oid();
        const job = await queue.add({ type: 'deploy', target: { repository: repo }, lockKey: `repo:${repo}` });
        expect(job.status).toBe('queued');
        expect(job.type).toBe('deploy');
    });

    it('claims a job atomically and only once', async () => {
        const repo = oid();
        await queue.add({ type: 'deploy', target: { repository: repo } });

        const [a, b] = await Promise.all([
            queue.claim('worker-a', 'local', 60000),
            queue.claim('worker-b', 'local', 60000)
        ]);
        const claimed = [a, b].filter(Boolean);
        expect(claimed.length).toBe(1);
        expect(claimed[0]!.status).toBe('active');
    });

    it('serializes by lockKey — never two active jobs for the same target', async () => {
        const repo = oid();
        const lockKey = `repo:${repo}`;
        await queue.add({ type: 'deploy', target: { repository: repo }, lockKey });
        await queue.add({ type: 'restart', target: { repository: repo }, lockKey });

        const first = await queue.claim('w1', 'local', 60000);
        expect(first).not.toBeNull();

        const second = await queue.claim('w2', 'local', 60000);
        expect(second).toBeNull();

        await queue.complete(first!._id.toString(), 'w1');
        const third = await queue.claim('w3', 'local', 60000);
        expect(third).not.toBeNull();
    });

    it('dedupes by idempotencyKey', async () => {
        const repo = oid();
        const key = `deploy:${repo}:abc123`;
        const a = await queue.add({ type: 'deploy', target: { repository: repo }, idempotencyKey: key });
        const b = await queue.add({ type: 'deploy', target: { repository: repo }, idempotencyKey: key });
        expect(a._id.toString()).toBe(b._id.toString());
        expect(await Job.countDocuments({ idempotencyKey: key })).toBe(1);
    });

    it('reschedules with backoff while attempts remain, then fails terminally', async () => {
        const job = await queue.add({ type: 'deploy', target: {}, maxAttempts: 2 });

        const claimed = await queue.claim('w', 'local', 60000);
        await queue.fail(claimed!._id.toString(), 'w', 'boom');
        let reloaded = await Job.findById(job._id);
        expect(reloaded!.status).toBe('delayed');
        expect(reloaded!.runAt.getTime()).toBeGreaterThan(Date.now());

        await Job.updateOne({ _id: job._id }, { status: 'queued', runAt: new Date() });
        const claimed2 = await queue.claim('w', 'local', 60000);
        await queue.fail(claimed2!._id.toString(), 'w', 'boom again');
        reloaded = await Job.findById(job._id);
        expect(reloaded!.status).toBe('failed');
    });

    it('sweep promotes due delayed jobs back to queued', async () => {
        const job = await queue.add({ type: 'deploy', target: {} });
        await Job.updateOne({ _id: job._id }, { status: 'delayed', runAt: new Date(Date.now() - 1000) });
        const promoted = await queue.sweep();
        expect(promoted).toBe(1);
        const reloaded = await Job.findById(job._id);
        expect(reloaded!.status).toBe('queued');
    });

    it('reclaims an active job whose lease expired (crash recovery)', async () => {
        const job = await queue.add({ type: 'deploy', target: {} });

        await queue.claim('dead-worker', 'local', -1000);
        const reclaimed = await queue.claim('live-worker', 'local', 60000);
        expect(reclaimed).not.toBeNull();
        expect(reclaimed!._id.toString()).toBe(job._id.toString());
        expect(reclaimed!.claimedBy).toBe('live-worker');
    });

    it('idempotency collapses only while in-flight, releases after a COMPLETED prior job', async () => {
        const repo = oid();
        const key = `deploy:${repo}:commit-rerun`;

        const a = await queue.add({ type: 'deploy', target: { repository: repo }, idempotencyKey: key });
        const b = await queue.add({ type: 'deploy', target: { repository: repo }, idempotencyKey: key });
        expect(a._id.toString()).toBe(b._id.toString());

        const claimed = await queue.claim('w', 'local', 60000);
        await queue.complete(claimed!._id.toString(), 'w');
        const c = await queue.add({ type: 'deploy', target: { repository: repo }, idempotencyKey: key });
        expect(c._id.toString()).not.toBe(a._id.toString());
    });

    it('idempotency releases after a FAILED-terminally prior job', async () => {
        const repo = oid();
        const key = `deploy:${repo}:commit-fail`;

        const d = await queue.add({
            type: 'deploy',
            target: { repository: repo },
            idempotencyKey: key,
            maxAttempts: 1
        });
        const claimed = await queue.claim('w', 'local', 60000);
        await queue.fail(claimed!._id.toString(), 'w', 'boom');
        const reloaded = await Job.findById(d._id);
        expect(reloaded!.status).toBe('failed');
        const e = await queue.add({
            type: 'deploy',
            target: { repository: repo },
            idempotencyKey: key
        });
        expect(e._id.toString()).not.toBe(d._id.toString());
    });

    it('heartbeat/complete/fail are no-ops when ownership was lost', async () => {
        const job = await queue.add({ type: 'deploy', target: {} });

        await queue.claim('worker-a', 'local', 1);
        await new Promise((r) => setTimeout(r, 10));
        const reclaimed = await queue.claim('worker-b', 'local', 60000);
        expect(reclaimed!._id.toString()).toBe(job._id.toString());

        expect(await queue.heartbeat(job._id.toString(), 'worker-a', 60000)).toBe(false);
        expect(await queue.complete(job._id.toString(), 'worker-a')).toBe(false);
        expect(await queue.fail(job._id.toString(), 'worker-a', 'phantom')).toBe(false);

        const reloaded = await Job.findById(job._id);
        expect(reloaded!.status).toBe('active');
        expect(reloaded!.claimedBy).toBe('worker-b');
        expect(reloaded!.error).toBeFalsy();

        expect(await queue.heartbeat(job._id.toString(), 'worker-b', 60000)).toBe(true);
        expect(await queue.complete(job._id.toString(), 'worker-b')).toBe(true);
    });
});
