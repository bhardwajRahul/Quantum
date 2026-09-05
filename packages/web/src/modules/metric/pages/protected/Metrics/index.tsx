import { useState } from 'react';
import { Activity } from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import PageHeader from '@/shared/components/layout/PageHeader';
import ListPageShell from '@/shared/components/ListPageShell';
import StatTile from '@/shared/components/StatTile';
import EntitySelect from '@/shared/components/EntitySelect';
import { useQuery } from '@/shared/hooks/api/use-query';
import { usePolledQuery } from '@/shared/hooks/api/use-polled-query';
import { metricApi } from '@/modules/metric/api/api';
import { repositoryApi } from '@/modules/repository/api/api';
import { metricErrorMessages } from '@/modules/metric/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import type { Metric } from '@quantum/contracts/modules/metric/domain';

const copy = errorCopy(metricErrorMessages);

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

    if(repositories.loading || repositories.error !== undefined){
        return (
            <ListPageShell
                bare
                loading={repositories.loading}
                loadingTitle='Loading repositories'
                error={repositories.error}
                errorTitle='Could not load repositories'
                getErrorDescription={copy}
                onRetry={repositories.reload}
            />
        );
    }

    const items = repositories.data ?? [];
    const samples = sortByTs(metrics.data ?? []);
    const latest = samples[samples.length - 1];

    return (
        <PageBody width='wide' height='full'>
            <PageHeader
                title='Metrics'
                description='Live container resource usage for a repository. Refreshes automatically every 10 seconds.'
            />

            <div className='mt-6 max-w-sm'>
                <EntitySelect
                    items={items}
                    getKey={(repository) => repository.id}
                    getLabel={(repository) => repository.name !== '' ? repository.name : repository.alias}
                    value={repositoryId}
                    onChange={(key) => setRepositoryId(Number(key))}
                    placeholder='Select a repository'
                    ariaLabel='Repository'
                />
            </div>

            <div className='mt-6 flex flex-1 flex-col'>
                <ListPageShell
                    loading={metrics.loading}
                    loadingTitle='Loading metrics'
                    error={metrics.error}
                    errorTitle='Could not load metrics'
                    getErrorDescription={copy}
                    onRetry={metrics.reload}
                    showPrompt={repositoryId === null}
                    prompt={{
                        icon: Activity,
                        title: 'Select a repository',
                        description: 'Choose one of your repositories above to view its live resource usage.'
                    }}
                    isEmpty={samples.length === 0 || latest === undefined}
                    empty={{
                        icon: Activity,
                        title: 'No samples yet',
                        description: 'This repository has no metric samples yet. Samples appear once its container starts reporting usage.'
                    }}
                >
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
                </ListPageShell>
            </div>
        </PageBody>
    );
};

export default Metrics;
