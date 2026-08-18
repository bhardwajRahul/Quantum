import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowRight, Rocket, RefreshCw, CircleDashed } from 'lucide-react';
import { useDocumentTitle, useTenancy } from '@hooks/common';
import { getRepositories } from '@services/repository/service';
import { getMyDockerContainers } from '@services/docker/container/service';
import { databases } from '@services/platform/service';
import {
    PageHeader, StatusBadge, EmptyState, DataTable, LoadingBlock, Button
} from '@components/atoms/kit';
import { unwrapList } from '@utilities/api/unwrap';
import { cn } from '@/lib/utils';

const safeList = async (fn) => {
    try{
        return unwrapList(await fn({}));
    }catch{
        return [];
    }
};

const plural = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;

const COLUMNS = [
    { key: 'name', header: 'Application' },
    {
        key: 'url',
        header: 'Repository',
        render: (row) => (
            <span className='font-mono text-xs text-muted-foreground truncate'>{row.url}</span>
        )
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> }
];

const OverviewCard = ({ title, value, context, onClick }) => (
    <button
        type='button'
        onClick={onClick}
        className={cn(
            'group flex flex-col rounded-xl border border-border bg-card p-6 text-left transition-colors',
            onClick && 'cursor-pointer hover:border-foreground/20'
        )}
    >
        <span className='text-sm font-medium text-foreground'>{title}</span>
        <span className='mt-3 text-5xl font-semibold tracking-tight text-foreground tabular-nums'>{value}</span>
        <span className='mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground'>
            <CircleDashed className='h-3.5 w-3.5 text-muted-foreground/60' />
            {context}
        </span>

        <span className='mt-6 h-px w-full bg-border' aria-hidden='true' />
    </button>
);

const Dashboard = () => {
    useDocumentTitle('Dashboard');
    const navigate = useNavigate();
    const { projectId } = useTenancy();

    const [loading, setLoading] = useState(true);
    const [repositories, setRepositories] = useState([]);
    const [containers, setContainers] = useState([]);
    const [dbs, setDbs] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);

        const [repos, conts, databaseList] = await Promise.all([
            safeList(getRepositories),
            safeList(getMyDockerContainers),
            projectId
                ? safeList(() => databases.listByProject({ query: { params: { projectId } } }))
                : Promise.resolve([])
        ]);
        setRepositories(repos);
        setContainers(conts);
        setDbs(databaseList);
        setLoading(false);
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    const runningContainers = containers.filter((c) => {
        const status = (c?.status || c?.state || '').toLowerCase();
        return status.includes('running') || status.includes('up');
    }).length;

    const domainCount = repositories.reduce((total, repo) => (
        Array.isArray(repo?.domains) ? total + repo.domains.length : total
    ), 0);

    const recentRepos = repositories.slice(0, 6);

    const goToRepository = (alias) => {
        if(alias) navigate(`/repository/${encodeURIComponent(alias)}/deployments/`);
    };

    const cards = [
        { title: 'Applications', value: repositories.length, context: `${plural(repositories.length, 'app')} deployed`, to: '/applications' },
        { title: 'Databases', value: dbs.length, context: projectId ? `${plural(dbs.length, 'database')} in project` : 'Select a project', to: '/applications' },
        { title: 'Domains', value: domainCount, context: `${plural(domainCount, 'domain')} bound`, to: '/domains' },
        { title: 'Containers', value: runningContainers, context: `${runningContainers} running · ${containers.length} total`, to: '/applications' }
    ];

    const rows = recentRepos.map((repo) => ({
        id: String(repo._id || repo.alias || repo.name),
        name: repo.alias || repo.name || '—',
        url: repo.url || '—',
        status: repo.activeDeployment?.status || repo.status || 'unknown',
        _alias: repo.alias || repo.name
    }));

    return (
        <div>
            <PageHeader
                title='Dashboard'
                subtitle='Your applications, databases and infrastructure at a glance.'
                actions={(
                    <Button variant='outline' onClick={load} disabled={loading}>
                        <RefreshCw className='h-4 w-4' /> Refresh
                    </Button>
                )}
            />

            {loading ? (
                <LoadingBlock label='Loading dashboard' />
            ) : (
                <div className='flex flex-col gap-12'>

                    <section>
                        <h2 className='mb-5 text-lg font-semibold tracking-tight text-foreground'>Overview</h2>
                        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                            {cards.map((c) => (
                                <OverviewCard
                                    key={c.title}
                                    title={c.title}
                                    value={c.value}
                                    context={c.context}
                                    onClick={() => navigate(c.to)}
                                />
                            ))}
                        </div>
                    </section>

                    <section>
                        <div className='flex items-center justify-between mb-4'>
                            <h2 className='text-lg font-semibold tracking-tight text-foreground'>Recent applications</h2>
                            {repositories.length > 0 && (
                                <Button variant='link' onClick={() => navigate('/applications')}>
                                    View all <ArrowRight className='h-4 w-4' />
                                </Button>
                            )}
                        </div>

                        {recentRepos.length === 0 ? (
                            <EmptyState
                                icon={Rocket}
                                title='Deploy your first app'
                                body='Connect a repository and Quantum will build, ship and run it for you.'
                                action={(
                                    <Button onClick={() => navigate('/repository/create')}>
                                        <Plus className='h-4 w-4' /> New application
                                    </Button>
                                )}
                            />
                        ) : (
                            <DataTable
                                columns={COLUMNS}
                                rows={rows}
                                onRowClick={(row) => goToRepository(row._alias)}
                            />
                        )}
                    </section>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
