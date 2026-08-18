import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Play, Square, RotateCw, Rocket, ExternalLink } from 'lucide-react';
import { useDocumentTitle } from '@hooks/common';
import useWebSocket from '@hooks/ws/useWebSocket';
import { formatDate } from '@utilities/common/dateUtils';
import * as deploymentOperations from '@services/deployment/operations';
import * as repositoryOperations from '@services/repository/operations';
import { setState as repoSetState } from '@services/repository/slice';
import { repositoryRollback } from '@services/platform/service';
import { PageHeader, StatusBadge, EmptyState, CopyInline, DataTable, LoadingBlock, BusyOverlay, Button, RowActionsMenu, ConfirmDialog } from '@components/atoms/kit';
import DeploymentPipeline from './DeploymentPipeline';

const COLUMNS = [
    { key: 'commit', header: 'Commit' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'environment', header: 'Environment' },
    { key: 'date', header: 'Date' },
    {
        key: 'url',
        header: 'URL',
        render: (row) => (
            row.url && row.url !== '—'
                ? (
                    <a
                        href={row.url}
                        target='_blank'
                        rel='noreferrer'
                        className='inline-flex items-center gap-1 text-primary hover:underline'
                    >
                        <span className='truncate max-w-[260px]'>{row.url}</span>
                        <ExternalLink className='h-3.5 w-3.5 shrink-0' />
                    </a>
                )
                : <CopyInline value={row.url} />
        )
    }
];

const NOTICE_TONES = {
    success: 'border-success/30 bg-success/10 text-success',
    error: 'border-destructive/30 bg-destructive/10 text-destructive',
    warning: 'border-warning/30 bg-warning/10 text-warning'
};

const matchesAlias = (repo, alias) =>
    repo && (String(repo.alias) === String(alias) || String(repo.name) === String(alias));

const RepositoryDeployments = () => {
    const dispatch = useDispatch();
    const { repositoryAlias } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const {
        selectedRepository, repositories, isLoading: isRepoListLoading,
        isOperationLoading: isRepoOperationLoading
    } = useSelector(state => state.repository);
    const { deployments, isLoading, isOperationLoading, error } = useSelector(state => state.deployment);
    const { user } = useSelector(state => state.auth);
    useDocumentTitle('Repository Deployments');

    const [pendingDelete, setPendingDelete] = useState(null);
    const [pendingRollback, setPendingRollback] = useState(null);
    const [rollingBack, setRollingBack] = useState(false);
    const [notice, setNotice] = useState(null);

    const [activeJobId, setActiveJobId] = useState(() => searchParams.get('job'));
    const [pipelineDone, setPipelineDone] = useState(false);

    const repo = matchesAlias(selectedRepository, repositoryAlias)
        ? selectedRepository
        : repositories.find((r) => matchesAlias(r, repositoryAlias)) || null;

    const didRequestRepos = useRef(false);
    useEffect(() => {
        if(!repo && !didRequestRepos.current){
            didRequestRepos.current = true;
            dispatch(repositoryOperations.getRepositories());
        }
    }, [repo, dispatch]);

    useEffect(() => {
        if(repo && repo !== selectedRepository){
            dispatch(repoSetState({ path: 'selectedRepository', value: repo }));
        }
    }, [repo, selectedRepository, dispatch]);

    useEffect(() => {
        if(repo?.name){
            dispatch(deploymentOperations.getRepositoryDeployments(repo.name));
        }
    }, [repo?.name, dispatch]);

    const refresh = () => {
        if(repo?.name) dispatch(deploymentOperations.getRepositoryDeployments(repo.name));
    };

    const [statusSocket, statusConnected] = useWebSocket({ query: { action: 'Status::Stream' } });
    useEffect(() => {
        if(!statusSocket || !statusConnected || !repo?._id) return undefined;
        const onStatus = (payload) => {
            if(!payload || String(payload.repositoryId) !== String(repo._id)) return;
            if(payload.jobId && !activeJobId){
                setActiveJobId(String(payload.jobId));
                setPipelineDone(false);
            }
            if(['success', 'failure', 'error', 'rolledback'].includes(payload.status)){
                setPipelineDone(true);
            }
            refresh();
        };
        statusSocket.on('deployment:status', onStatus);
        return () => { statusSocket.off('deployment:status', onStatus); };
    }, [statusSocket, statusConnected, repo?._id, activeJobId]);

    const dismissPipeline = () => {
        setActiveJobId(null);
        if(searchParams.get('job')){
            searchParams.delete('job');
            setSearchParams(searchParams, { replace: true });
        }
    };

    const lifecycleAction = (action) => {
        if(repo?.alias) dispatch(deploymentOperations.repositoryActions(repo.alias, { action }));
    };

    const confirmDelete = () => {
        if(pendingDelete?._deploymentId && repo?.name){
            dispatch(deploymentOperations.deleteRepositoryDeployment(repo.name, pendingDelete._deploymentId));
        }
        setPendingDelete(null);
    };

    const confirmRollback = async () => {
        if(!pendingRollback?._deploymentId || !repo?._id) { setPendingRollback(null); return; }
        setRollingBack(true);
        try{
            await repositoryRollback({
                query: { params: { id: repo._id, deploymentId: pendingRollback._deploymentId } }
            });
            setNotice({ kind: 'success', title: 'Rollback enqueued', subtitle: 'The previous artifact is being redeployed. This may take a few moments.' });
            refresh();
        }catch(err){
            setNotice({ kind: 'error', title: 'Rollback failed', subtitle: String(err?.message || err) });
        }finally{
            setRollingBack(false);
            setPendingRollback(null);
        }
    };

    const isStarted = repo?.activeDeployment?.status === 'success';
    const githubUsername = user?.github?.username;
    const repoLabel = githubUsername && repo?.name
        ? `${githubUsername}/${repo.name}`
        : (repo?.name || repositoryAlias);

    const rows = deployments.map((deployment, index) => ({
        id: String(deployment.id || deployment._id || index),
        commit: deployment.commit?.message || '—',
        status: deployment.status || 'unknown',
        environment: deployment.environment || '—',
        date: deployment.created_at ? formatDate(deployment.created_at) : '—',
        url: deployment.url || '—',
        _deploymentId: deployment.id || deployment._id,
        _hasArtifact: Boolean(deployment.artifact?.image)
    }));

    const operationLoading = isOperationLoading || isRepoOperationLoading;

    if(!repo){
        return (
            <div>
                {isRepoListLoading ? (
                    <LoadingBlock label='Loading application' />
                ) : (
                    <EmptyState
                        icon={Rocket}
                        title='Application not found'
                        body={`We couldn't find an application matching "${repositoryAlias}". It may have been removed.`}
                    />
                )}
            </div>
        );
    }

    const noticeTone = NOTICE_TONES[notice?.kind] || NOTICE_TONES.warning;

    return (
        <div>
            <BusyOverlay
                show={operationLoading || rollingBack}
                message='Processing, please wait a few seconds...'
            />

            <PageHeader
                title='Deployments'
                subtitle={`Continuously generated from ${repoLabel}`}
                actions={(
                    <>
                        {isStarted ? (
                            <Button
                                variant='outline'
                                className='border-destructive/40 text-destructive hover:bg-destructive/10'
                                onClick={() => lifecycleAction('stop')}
                            >
                                <Square className='h-4 w-4' /> Stop
                            </Button>
                        ) : (
                            <Button
                                variant='outline'
                                onClick={() => lifecycleAction('start')}
                            >
                                <Play className='h-4 w-4' /> Start
                            </Button>
                        )}
                        <Button
                            variant='outline'
                            onClick={() => lifecycleAction('restart')}
                        >
                            <RotateCw className='h-4 w-4' /> Restart
                        </Button>
                    </>
                )}
            />

            {notice && (
                <div className={`mb-6 flex items-start justify-between gap-4 rounded-lg border px-4 py-3 ${noticeTone}`}>
                    <div>
                        <p className='font-medium'>{notice.title}</p>
                        <p className='text-sm opacity-90'>{notice.subtitle}</p>
                    </div>
                    <button
                        type='button'
                        className='shrink-0 text-sm opacity-70 hover:opacity-100'
                        onClick={() => setNotice(null)}
                        aria-label='Dismiss'
                    >
                        ✕
                    </button>
                </div>
            )}

            {error && (
                <p className='mb-6 text-sm text-destructive'>{String(error)}</p>
            )}

            {activeJobId && (
                <DeploymentPipeline
                    jobId={activeJobId}
                    title='Deploying your application'
                    done={pipelineDone}
                    onDismiss={dismissPipeline}
                />
            )}

            {isLoading ? (
                <LoadingBlock label='Loading deployments' />
            ) : deployments.length === 0 ? (
                !activeJobId && (
                    <EmptyState
                        icon={Rocket}
                        title='No deployments yet'
                        body='There is no deployment registered in the repository.'
                    />
                )
            ) : (
                <DataTable
                    columns={COLUMNS}
                    rows={rows}
                    actions={(row) => (
                        <RowActionsMenu items={[
                            { label: 'Rollback', disabled: !row._hasArtifact, onClick: () => setPendingRollback(row) },
                            { label: 'Delete', danger: true, separatorBefore: true, onClick: () => setPendingDelete(row) }
                        ]} />
                    )}
                />
            )}

            <ConfirmDialog
                open={Boolean(pendingRollback)}
                onCancel={() => setPendingRollback(null)}
                onConfirm={confirmRollback}
                title='Roll back deployment'
                description='This will redeploy the artifact from this deployment, replacing the currently running version. The operation is queued and may take a few moments.'
                confirmLabel='Roll back'
                destructive
            />

            <ConfirmDialog
                open={Boolean(pendingDelete)}
                onCancel={() => setPendingDelete(null)}
                onConfirm={confirmDelete}
                title='Delete deployment'
                description='This will permanently delete this deployment record. This action cannot be undone.'
                confirmLabel='Delete'
                destructive
            />
        </div>
    );
};

export default RepositoryDeployments;
