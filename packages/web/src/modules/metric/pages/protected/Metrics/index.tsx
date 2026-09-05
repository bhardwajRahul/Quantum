import { useState } from 'react';
import { Card } from '@heroui/react';
import { Activity } from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import LoadingState from '@/shared/components/LoadingState';
import ErrorState from '@/shared/components/ErrorState';
import EmptyState from '@/shared/components/EmptyState';
import CenterState from '@/shared/components/CenterState';
import RepositorySelect from '@/modules/metric/components/RepositorySelect';
import { useQuery } from '@/shared/hooks/api/use-query';
import { usePolledQuery } from '@/shared/hooks/api/use-polled-query';
import { metricApi } from '@/modules/metric/api/api';
import { repositoryApi } from '@/modules/repository/api/api';
import type { Metric } from '@quantum/contracts/modules/metric/domain';

const BYTE_UNITS = ['KB', 'MB', 'GB', 'TB'];

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

const formatBytes = (value: number): string => {
    if(value < 1024) return `${Math.round(value)} B`;

    let scaled = value / 1024;
    let index = 0;
    while(scaled >= 1024 && index < BYTE_UNITS.length - 1){
        scaled /= 1024;
        index++;
    }

    return `${scaled.toFixed(1)} ${BYTE_UNITS[index]}`;
};

const sortByTs = (samples: Metric[]): Metric[] =>
    [...samples].sort((a, b) => new Date(a.ts).valueOf() - new Date(b.ts).valueOf());

interface StatTileProps{
    label: string;
    value: string;
}

const StatTile = ({ label, value }: StatTileProps) => (
    <Card>
        <Card.Content className='flex flex-col gap-1'>
            <span className='text-[0.8125rem] text-muted'>{label}</span>
            <span className='text-2xl font-medium text-foreground'>{value}</span>
        </Card.Content>
    </Card>
);

interface PercentBarChartProps{
    label: string;
    values: number[];
}

const PercentBarChart = ({ label, values }: PercentBarChartProps) => (
    <div>
        <span className='text-[0.8125rem] text-muted'>{label}</span>
        <div className='mt-2 flex h-32 items-end gap-1 rounded-xl bg-foreground/[0.04] p-3'>
            {values.map((value, index) => (
                <div
                    key={index}
                    className='flex-1 rounded-t bg-foreground/70'
                    style={{ height: `${clampPercent(value)}%` }}
                />
            ))}
        </div>
    </div>
);

const Metrics = () => {
    const repositories = useQuery(repositoryApi.mine, []);
    const [repositoryId, setRepositoryId] = useState<number | null>(null);

    const metrics = usePolledQuery(
        useQuery(
            (metricRepositoryId: number, query: { limit?: number }) =>
                metricApi.byRepository({ path: { repositoryId: metricRepositoryId }, query }),
            [repositoryId ?? undefined, { limit: 60 }],
            { enabled: repositoryId !== null }
        ),
        { while: (data) => data !== null, everyMs: 10000 }
    );

    if(repositories.loading) return <LoadingState title='Loading repositories' compact />;
    if(repositories.error !== undefined){
        return (
            <ErrorState
                title='Could not load repositories'
                description={repositories.error.message}
                onRetry={repositories.reload}
            />
        );
    }

    const items = repositories.data ?? [];
    const samples = sortByTs(metrics.data ?? []);
    const latest = samples[samples.length - 1];

    return (
        <PageBody width='wide' height='full'>
            <div>
                <h1 className='text-lg font-medium text-foreground'>Metrics</h1>
                <p className='mt-1.5 text-sm text-muted'>
                    Live container resource usage for a repository. Refreshes automatically every 10 seconds.
                </p>
            </div>

            <div className='mt-6 max-w-sm'>
                <RepositorySelect
                    repositories={items}
                    value={repositoryId}
                    onChange={setRepositoryId}
                />
            </div>

            <div className='mt-6 flex flex-1 flex-col'>
                {repositoryId === null ? (
                    <CenterState>
                        <EmptyState
                            icon={Activity}
                            title='Select a repository'
                            description='Choose one of your repositories above to view its live resource usage.'
                        />
                    </CenterState>
                ) : metrics.loading ? (
                    <CenterState><LoadingState title='Loading metrics' compact /></CenterState>
                ) : metrics.error !== undefined ? (
                    <CenterState>
                        <ErrorState
                            title='Could not load metrics'
                            description={metrics.error.message}
                            onRetry={metrics.reload}
                        />
                    </CenterState>
                ) : samples.length === 0 || latest === undefined ? (
                    <CenterState>
                        <EmptyState
                            icon={Activity}
                            title='No samples yet'
                            description='This repository has no metric samples yet. Samples appear once its container starts reporting usage.'
                        />
                    </CenterState>
                ) : (
                    <div className='flex flex-col gap-6'>
                        <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5'>
                            <StatTile label='CPU' value={formatPercent(latest.cpuPercent)} />
                            <StatTile
                                label='Memory'
                                value={`${formatPercent(latest.memPercent)} (${formatBytes(latest.memUsage)} / ${formatBytes(latest.memLimit)})`}
                            />
                            <StatTile label='Network RX' value={formatBytes(latest.netRx)} />
                            <StatTile label='Network TX' value={formatBytes(latest.netTx)} />
                            <StatTile label='PIDs' value={String(latest.pids)} />
                        </div>

                        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
                            <PercentBarChart label='CPU %' values={samples.map((sample) => sample.cpuPercent)} />
                            <PercentBarChart label='Memory %' values={samples.map((sample) => sample.memPercent)} />
                        </div>
                    </div>
                )}
            </div>
        </PageBody>
    );
};

export default Metrics;
