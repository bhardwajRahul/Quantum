import { JobQueue, MongoJobQueue } from '@services/queue/jobQueue';

export const queue: JobQueue = new MongoJobQueue();

export default queue;
export * from '@services/queue/jobQueue';
