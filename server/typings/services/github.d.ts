export type DeploymentState = 'error' | 'failure' | 'inactive' | 'in_progress' | 'queued' | 'pending' | 'success';

declare module 'express-session'{
    interface SessionData{
        userId?: string;
    }
}