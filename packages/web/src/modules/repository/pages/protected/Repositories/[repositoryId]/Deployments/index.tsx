import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button, Chip, Table } from '@heroui/react';
import {
    CheckCircle2,
    CircleDashed,
    ExternalLink,
    Loader2,
    Play,
    Rocket,
    RotateCw,
    Square,
    XCircle
} from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import LoadingState from '@/shared/components/LoadingState';
import ErrorState from '@/shared/components/ErrorState';
import EmptyState from '@/shared/components/EmptyState';
import InlineError from '@/shared/components/InlineError';
import ConfirmDialog from '@/shared/components/ConfirmDialog';
import { useQuery } from '@/shared/hooks/api/use-query';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { useChannel } from '@/shared/hooks/socket/use-channel';
import { repositoryApi } from '@/modules/repository/api/api';
import { deploymentApi } from '@/modules/repository/api/deployment-api';
import { activityApi } from '@/modules/activity/api/api';
import { deploymentStatusColor, deploymentStatusLabel, isDeploymentInProgress } from '@/modules/repository/utils/deployment-status';
import { formatDate } from '@/modules/repository/utils/format-date';
import { repositoryDetailErrorMessages } from '@/modules/repository/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import { RepositoryOperation } from '@quantum/contracts/modules/repository/domain';
import { ActivityLevel } from '@quantum/contracts/modules/activity/domain';
import type { Deployment, DeploymentStatusFrame } from '@quantum/contracts/modules/deployment/domain';
import type { RepositoryOperationInput } from '@quantum/contracts/modules/deployment/http';
import type { Repository } from '@quantum/contracts/modules/repository/domain';
import type { ActivityEvent } from '@quantum/contracts/modules/activity/domain';

const copy = errorCopy(repositoryDetailErrorMessages);

const LOG_LINE_LIMIT = 200;

interface DeploymentsHeaderProps{
    repository: Repository;
    isOperating: boolean;
    onOperate: (operation: RepositoryOperation) => void;
}

const DeploymentsHeader = ({ repository, isOperating, onOperate }: DeploymentsHeaderProps) => {
    const isRunning = repository.containerId !== null;

    return (
        <div className='flex items-center justify-between gap-4'>
            <div>
                <h1 className='text-lg font-medium text-foreground'>Deployments</h1>
                <p className='mt-1.5 text-sm text-muted'>Continuously generated from {repository.alias}.</p>
            </div>

            <div className='flex gap-2'>
                <Button
                    variant='secondary'
                    isDisabled={isRunning || isOperating}
                    onPress={() => onOperate(RepositoryOperation.Start)}
                >
                    <Play aria-hidden='true' className='size-4' />
                    Start
                </Button>
                <Button
                    variant='secondary'
                    isDisabled={!isRunning || isOperating}
                    onPress={() => onOperate(RepositoryOperation.Stop)}
                >
                    <Square aria-hidden='true' className='size-4' />
                    Stop
                </Button>
                <Button variant='secondary' isDisabled={isOperating} onPress={() => onOperate(RepositoryOperation.Restart)}>
                    <RotateCw aria-hidden='true' className='size-4' />
                    Restart
                </Button>
            </div>
        </div>
    );
};

interface DeploymentsTableProps{
    deployments: Deployment[];
    onRollback: (deployment: Deployment) => void;
    onDelete: (deployment: Deployment) => void;
}

const DeploymentsTable = ({ deployments, onRollback, onDelete }: DeploymentsTableProps) => (
    <Table aria-label='Deployments'>
        <Table.Header>
            <Table.Column isRowHeader>Commit</Table.Column>
            <Table.Column>Status</Table.Column>
            <Table.Column>Date</Table.Column>
            <Table.Column>URL</Table.Column>
            <Table.Column><span className='sr-only'>Actions</span></Table.Column>
        </Table.Header>

        <Table.Body>
            {deployments.map((deployment) => (
                <Table.Row key={deployment.id}>
                    <Table.Cell>
                        <span className='font-medium text-foreground'>{deployment.commit?.message ?? '—'}</span>
                    </Table.Cell>
                    <Table.Cell>
                        <Chip size='sm' variant='soft' className={deploymentStatusColor(deployment.status)}>
                            {deploymentStatusLabel(deployment.status)}
                        </Chip>
                    </Table.Cell>
                    <Table.Cell>{formatDate(deployment.createdAt)}</Table.Cell>
                    <Table.Cell>
                        {deployment.url ? (
                            <a
                                href={deployment.url}
                                target='_blank'
                                rel='noreferrer'
                                className='inline-flex items-center gap-1 text-[var(--accent)] hover:underline'
                            >
                                <span className='max-w-[220px] truncate'>{deployment.url}</span>
                                <ExternalLink aria-hidden='true' className='size-3.5 shrink-0' />
                            </a>
                        ) : '—'}
                    </Table.Cell>
                    <Table.Cell>
                        <div className='flex justify-end gap-2'>
                            <Button
                                size='sm'
                                variant='secondary'
                                isDisabled={deployment.artifact === null}
                                onPress={() => onRollback(deployment)}
                            >
                                Rollback
                            </Button>
                            <Button size='sm' variant='danger-soft' onPress={() => onDelete(deployment)}>Delete</Button>
                        </div>
                    </Table.Cell>
                </Table.Row>
            ))}
        </Table.Body>
    </Table>
);

interface RollbackDeploymentDialogProps{
    deployment: Deployment | null;
    onClose: () => void;
    onRolledBack: () => void;
}

const RollbackDeploymentDialog = ({ deployment, onClose, onRolledBack }: RollbackDeploymentDialogProps) => {
    const rollback = useMutation((repositoryId: number, deploymentId: number) =>
        repositoryApi.rollback(repositoryId, deploymentId));

    const handleConfirm = async () => {
        if(deployment === null) return;

        const rolledBack = await rollback
            .run(deployment.repositoryId, deployment.id)
            .then(() => true, () => false);
        if(!rolledBack) return;

        onClose();
        onRolledBack();
    };

    return (
        <ConfirmDialog
            isOpen={deployment !== null}
            onOpenChange={(isOpen) => { if(!isOpen) onClose(); }}
            title='Roll back deployment'
            description='This redeploys the artifact from this deployment, replacing the currently running version.'
            confirmLabel='Roll back'
            isPending={rollback.loading}
            error={copy(rollback.error)}
            onConfirm={() => { void handleConfirm(); }}
        />
    );
};

interface DeleteDeploymentDialogProps{
    deployment: Deployment | null;
    onClose: () => void;
    onDeleted: () => void;
}

const DeleteDeploymentDialog = ({ deployment, onClose, onDeleted }: DeleteDeploymentDialogProps) => {
    const remove = useMutation((id: number) => deploymentApi.remove(id));

    const handleDelete = async () => {
        if(deployment === null) return;

        const deleted = await remove.run(deployment.id).then(() => true, () => false);
        if(!deleted) return;

        onClose();
        onDeleted();
    };

    return (
        <ConfirmDialog
            isOpen={deployment !== null}
            onOpenChange={(isOpen) => { if(!isOpen) onClose(); }}
            title='Delete deployment'
            description='This permanently deletes this deployment record. This action cannot be undone.'
            confirmLabel='Delete'
            isPending={remove.loading}
            error={copy(remove.error)}
            onConfirm={() => { void handleDelete(); }}
        />
    );
};

const stepIcon = (level: ActivityLevel) => {
    switch(level){
        case ActivityLevel.Progress:
            return <Loader2 aria-hidden='true' className='size-4 shrink-0 animate-spin text-warning motion-reduce:animate-none' />;
        case ActivityLevel.Success:
            return <CheckCircle2 aria-hidden='true' className='size-4 shrink-0 text-success' />;
        case ActivityLevel.Error:
            return <XCircle aria-hidden='true' className='size-4 shrink-0 text-danger' />;
        default:
            return <CircleDashed aria-hidden='true' className='size-4 shrink-0 text-muted' />;
    }
};

const formatStepDuration = (durationMs: number): string =>
    durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`;

const stepDurationMs = (event: ActivityEvent): number | null => {
    const value = event.meta.durationMs;
    return typeof value === 'number' ? value : null;
};

const stepIndex = (event: ActivityEvent): number | null => {
    const value = event.meta.stepIndex;
    return typeof value === 'number' ? value : null;
};

const sortSteps = (events: ActivityEvent[]): ActivityEvent[] =>
    [...events].sort((a, b) => {
        const indexA = stepIndex(a);
        const indexB = stepIndex(b);
        return indexA === null || indexB === null ? 0 : indexA - indexB;
    });

interface PipelineStepProps{
    event: ActivityEvent;
}

const PipelineStep = ({ event }: PipelineStepProps) => {
    const duration = stepDurationMs(event);

    return (
        <li className='flex items-center gap-3 border-t border-border/60 px-5 py-3 first:border-t-0'>
            {stepIcon(event.level)}
            <span className='flex-1 truncate text-[0.875rem] text-foreground'>{event.title}</span>
            {duration !== null && <span className='font-mono text-[0.75rem] text-muted'>{formatStepDuration(duration)}</span>}
        </li>
    );
};

interface PipelineLogsProps{
    lines: string[];
}

const PipelineLogs = ({ lines }: PipelineLogsProps) => {
    if(lines.length === 0) return null;

    return (
        <details className='border-t border-border/60 px-5 py-3'>
            <summary className='cursor-pointer text-[0.8125rem] text-muted'>Raw logs</summary>
            <pre className='mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap text-[0.75rem] text-muted'>{lines.join('\n')}</pre>
        </details>
    );
};

interface DeploymentPipelinePanelProps{
    steps: ActivityEvent[];
    logs: string[];
    done: boolean;
    onDismiss: () => void;
}

const DeploymentPipelinePanel = ({ steps, logs, done, onDismiss }: DeploymentPipelinePanelProps) => {
    const hasError = steps.some((event) => event.level === ActivityLevel.Error);
    const ordered = sortSteps(steps);

    return (
        <div className='mt-6 rounded-xl border border-border'>
            <div className='flex items-center gap-3 border-b border-border px-5 py-3.5'>
                {!done ? (
                    <Loader2 aria-hidden='true' className='size-4 shrink-0 animate-spin text-warning motion-reduce:animate-none' />
                ) : hasError ? (
                    <XCircle aria-hidden='true' className='size-4 shrink-0 text-danger' />
                ) : (
                    <CheckCircle2 aria-hidden='true' className='size-4 shrink-0 text-success' />
                )}

                <span className='flex-1 text-[0.875rem] font-medium text-foreground'>
                    {!done ? 'Deploying your application' : hasError ? 'Deployment failed' : 'Deployment finished'}
                </span>

                {done && <Button size='sm' variant='ghost' onPress={onDismiss}>Dismiss</Button>}
            </div>

            <ol>
                {ordered.length === 0 ? (
                    <li className='flex items-center gap-3 px-5 py-3 text-[0.875rem] text-muted'>
                        <Loader2 aria-hidden='true' className='size-4 shrink-0 animate-spin text-warning motion-reduce:animate-none' />
                        Queued — waiting for the build to start…
                    </li>
                ) : (
                    ordered.map((event) => <PipelineStep key={event.id} event={event} />)
                )}
            </ol>

            <PipelineLogs lines={logs} />
        </div>
    );
};

const Deployments = () => {
    const { repositoryId } = useParams<{ repositoryId: string }>();
    const id = repositoryId !== undefined ? Number(repositoryId) : undefined;
    const [searchParams, setSearchParams] = useSearchParams();

    const repository = useQuery(repositoryApi.get, [id]);
    const deploymentsQuery = useQuery(deploymentApi.listByRepository, [id]);

    const [activeJobId, setActiveJobId] = useState<string | null>(() => searchParams.get('job'));
    const [pipelineDone, setPipelineDone] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [steps, setSteps] = useState<ActivityEvent[]>([]);
    const [rollbackTarget, setRollbackTarget] = useState<Deployment | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Deployment | null>(null);

    const operate = useMutation((repositoryOperationId: number, body: RepositoryOperationInput) =>
        deploymentApi.operate(repositoryOperationId, body));

    const handleOperate = async (operation: RepositoryOperation) => {
        if(id === undefined) return;

        const accepted = await operate.run(id, { operation }).then((result) => result, () => null);
        if(accepted === null) return;

        setActiveJobId(String(accepted.jobId));
        setPipelineDone(false);
        setLogs([]);
    };

    const handleStatusFrame = (frame: DeploymentStatusFrame) => {
        deploymentsQuery.reload();
        if(!isDeploymentInProgress(frame.status)) setPipelineDone(true);
    };

    const deploymentChannel = useChannel('/deployment/stream', {
        'deployment.statusChanged': handleStatusFrame,
        'deployment.completed': handleStatusFrame,
        'deployment.log': (frame) => setLogs((previous) => [...previous, frame.line].slice(-LOG_LINE_LIMIT))
    });

    useEffect(() => {
        if(id === undefined) return;
        deploymentChannel.send('subscribe', { repositoryId: id });
    }, [id, deploymentChannel.send]);

    const stepsQuery = useQuery(
        activityApi.list,
        [activeJobId !== null ? { correlationId: activeJobId } : undefined],
        { enabled: activeJobId !== null }
    );

    useEffect(() => {
        setSteps([]);
    }, [activeJobId]);

    useEffect(() => {
        if(stepsQuery.data) setSteps(stepsQuery.data);
    }, [stepsQuery.data]);

    const activityChannel = useChannel('/activity/stream', {
        'activity.created': (event) => {
            if(event.correlationId === activeJobId) setSteps((previous) => [...previous, event]);
        }
    });

    useEffect(() => {
        activityChannel.send('subscribe', {});
    }, [activityChannel.send]);

    const handleDismiss = () => {
        setActiveJobId(null);
        setSearchParams((previous) => {
            if(!previous.has('job')) return previous;
            const next = new URLSearchParams(previous);
            next.delete('job');
            return next;
        }, { replace: true });
    };

    if(id === undefined || repository.loading || deploymentsQuery.loading){
        return <LoadingState title='Loading deployments' compact />;
    }

    if(repository.error !== undefined){
        return <ErrorState title='Could not load repository' description={copy(repository.error)} onRetry={repository.reload} />;
    }
    if(deploymentsQuery.error !== undefined){
        return (
            <ErrorState
                title='Could not load deployments'
                description={copy(deploymentsQuery.error)}
                onRetry={deploymentsQuery.reload}
            />
        );
    }
    if(repository.data === null) return null;

    const deployments = deploymentsQuery.data ?? [];

    return (
        <PageBody width='wide'>
            <DeploymentsHeader
                repository={repository.data}
                isOperating={operate.loading}
                onOperate={(operation) => { void handleOperate(operation); }}
            />

            {operate.error !== undefined && <InlineError className='mt-4'>{copy(operate.error)}</InlineError>}

            {activeJobId && (
                <DeploymentPipelinePanel steps={steps} logs={logs} done={pipelineDone} onDismiss={handleDismiss} />
            )}

            <div className='mt-6'>
                {deployments.length === 0 ? (
                    !activeJobId && (
                        <EmptyState
                            icon={Rocket}
                            title='No deployments yet'
                            description='Start this application to create its first deployment.'
                        />
                    )
                ) : (
                    <DeploymentsTable deployments={deployments} onRollback={setRollbackTarget} onDelete={setDeleteTarget} />
                )}
            </div>

            <RollbackDeploymentDialog
                deployment={rollbackTarget}
                onClose={() => setRollbackTarget(null)}
                onRolledBack={deploymentsQuery.reload}
            />

            <DeleteDeploymentDialog
                deployment={deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onDeleted={deploymentsQuery.reload}
            />
        </PageBody>
    );
};

export default Deployments;
