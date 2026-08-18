import { v4 } from 'uuid';
import { JobQueue } from '@services/queue/jobQueue';
import { dispatch } from '@services/orchestrator/dispatch';
import { emitJobStatus } from '@services/orchestrator/events';
import logger from '@utilities/logger';

export interface WorkerOptions{
    nodeId?: string;
    concurrency?: number;
    leaseMs?: number;
    pollIntervalMs?: number;
}

export class Worker{
    private queue: JobQueue;
    private workerId: string;
    private nodeId: string;
    private concurrency: number;
    private leaseMs: number;
    private pollIntervalMs: number;
    private running = false;
    private active = 0;
    private loopTimer: NodeJS.Timeout | null = null;
    private sweepTimer: NodeJS.Timeout | null = null;

    constructor(queue: JobQueue, options: WorkerOptions = {}){
        this.queue = queue;
        this.workerId = `${options.nodeId || 'local'}:${v4().slice(0, 8)}`;
        this.nodeId = options.nodeId || process.env.NODE_ID || 'local';
        this.concurrency = options.concurrency || Number(process.env.ORCHESTRATOR_CONCURRENCY) || 3;
        this.leaseMs = options.leaseMs || Number(process.env.JOB_LEASE_MS) || 120000;
        this.pollIntervalMs = options.pollIntervalMs || 1000;
    }

    start(): void{
        if(this.running) return;
        this.running = true;
        logger.info(`@services/orchestrator/worker.ts: worker ${this.workerId} started (node=${this.nodeId}, concurrency=${this.concurrency}).`);
        this.scheduleLoop();

        this.sweepTimer = setInterval(() => {
            this.queue.sweep().catch((error) => logger.error('@services/orchestrator/worker.ts (sweep): ' + error));
        }, Math.min(this.leaseMs / 2, 15000));
    }

    async stop(): Promise<void>{
        this.running = false;
        if(this.loopTimer) clearTimeout(this.loopTimer);
        if(this.sweepTimer) clearInterval(this.sweepTimer);
    }

    private scheduleLoop(): void{
        if(!this.running) return;
        this.loopTimer = setTimeout(() => this.tick(), this.pollIntervalMs);
    }

    private async tick(): Promise<void>{
        if(!this.running) return;
        try{

            while(this.active < this.concurrency){
                const job = await this.queue.claim(this.workerId, this.nodeId, this.leaseMs);
                if(!job) break;
                this.active++;
                this.process(job).finally(() => { this.active--; });
            }
        }catch(error){
            logger.error('@services/orchestrator/worker.ts (tick): ' + error);
        }finally{
            this.scheduleLoop();
        }
    }

    private async process(job: any): Promise<void>{
        const jobId = job._id.toString();
        const userId = job.target?.user?.toString();

        const heartbeat = setInterval(async () => {
            try{
                const ok = await this.queue.heartbeat(jobId, this.workerId, this.leaseMs);
                if(!ok){
                    clearInterval(heartbeat);
                    logger.warn(`@services/orchestrator/worker.ts: lost ownership of job ${jobId} mid-flight (lease reclaimed)`);
                }
            }catch{   }
        }, Math.max(this.leaseMs / 3, 10000));
        try{
            emitJobStatus(userId, { jobId, type: job.type, status: 'active' });
            await dispatch(job);
            const won = await this.queue.complete(jobId, this.workerId);
            if(!won){

                logger.warn(`@services/orchestrator/worker.ts: job ${jobId} completed but ownership was lost`);
                return;
            }
            emitJobStatus(userId, { jobId, type: job.type, status: 'completed' });
        }catch(error: any){
            const message = error?.message || String(error);
            const won = await this.queue.fail(jobId, this.workerId, message);
            if(won){
                emitJobStatus(userId, { jobId, type: job.type, status: 'failed', error: message });
            }
            logger.error(`@services/orchestrator/worker.ts: job ${jobId} (${job.type}) handler error: ${message}`);
        }finally{
            clearInterval(heartbeat);
        }
    }
}

export default Worker;
