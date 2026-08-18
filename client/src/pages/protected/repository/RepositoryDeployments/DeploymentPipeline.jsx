import { CheckCircle2, XCircle, Loader2, CircleDashed } from 'lucide-react';
import useDeploymentPipeline from '@hooks/ws/useDeploymentPipeline';

const ICON = {
    success: <CheckCircle2 className='h-4 w-4 text-success' />,
    error: <XCircle className='h-4 w-4 text-destructive' />,
    progress: <Loader2 className='h-4 w-4 animate-spin text-primary' />
};

const fmtDuration = (ms) => {
    if(!ms && ms !== 0) return '';
    if(ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
};

const DeploymentPipeline = ({ jobId, title = 'Deploying', done = false, onDismiss }) => {
    const steps = useDeploymentPipeline(jobId, Boolean(jobId) && !done);

    if(!jobId) return null;

    const hasError = steps.some((s) => s.level === 'error');
    const running = !done && !hasError;

    return (
        <div className='mb-8 rounded-xl border border-border bg-card'>
            <div className='flex items-center gap-3 border-b border-border px-5 py-3.5'>
                {running
                    ? <Loader2 className='h-4 w-4 animate-spin text-primary' />
                    : hasError
                        ? <XCircle className='h-4 w-4 text-destructive' />
                        : <CheckCircle2 className='h-4 w-4 text-success' />}
                <span className='flex-1 text-sm font-medium text-foreground'>
                    {hasError ? 'Deployment failed' : (done ? 'Deployment finished' : title)}
                </span>
                {done && onDismiss && (
                    <button
                        type='button'
                        onClick={onDismiss}
                        className='text-xs text-muted-foreground hover:text-foreground'
                    >
                        Dismiss
                    </button>
                )}
            </div>
            <ol className='flex flex-col'>
                {steps.length === 0 ? (
                    <li className='flex items-center gap-3 px-5 py-3 text-sm text-muted-foreground'>
                        <Loader2 className='h-4 w-4 animate-spin text-primary' />
                        Queued — waiting for the build to start…
                    </li>
                ) : steps.map((step) => (
                    <li
                        key={step.stepIndex}
                        className='flex items-center gap-3 border-t border-border/60 px-5 py-3 first:border-t-0'
                    >
                        {ICON[step.level] || <CircleDashed className='h-4 w-4 text-muted-foreground' />}
                        <span className='flex-1 text-sm text-foreground'>{step.title}</span>
                        {step.message && step.level === 'error' && (
                            <span className='max-w-[40%] truncate text-xs text-destructive'>{step.message}</span>
                        )}
                        {step.durationMs != null && (
                            <span className='font-mono text-xs text-muted-foreground'>{fmtDuration(step.durationMs)}</span>
                        )}
                    </li>
                ))}
            </ol>
        </div>
    );
};

export default DeploymentPipeline;
