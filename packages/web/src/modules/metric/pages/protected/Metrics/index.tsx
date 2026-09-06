import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useRememberedSelection } from '@/shared/hooks/use-remembered-selection';
import { Activity } from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import PageHeader from '@/shared/components/layout/PageHeader';
import ListPageShell from '@/shared/components/ListPageShell';
import StatTile from '@/shared/components/StatTile';
import StatBand from '@/shared/components/StatBand';
import Sparkline from '@/shared/components/charts/Sparkline';
import ChartPanel from '@/shared/components/charts/ChartPanel';
import ChartLegend from '@/shared/components/charts/ChartLegend';
import ChartTooltip from '@/shared/components/charts/ChartTooltip';
import { AXIS, CURSOR, GRID_STROKE } from '@/shared/components/charts/axes';
import EntitySelect from '@/shared/components/EntitySelect';
import { useQuery } from '@/shared/hooks/api/use-query';
import { usePolledQuery } from '@/shared/hooks/api/use-polled-query';
import { metricApi } from '@/modules/metric/api/api';
import { repositoryApi } from '@/modules/repository/api/api';
import { metricErrorMessages } from '@/modules/metric/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import { formatBytes } from '@/shared/utils/format-bytes';
import { formatDate } from '@/shared/utils/format-date';
import { count, rate } from '@/shared/utils/format-metrics';
import type { Metric } from '@quantum/contracts/modules/metric/domain';

const copy = errorCopy(metricErrorMessages);

const clockLabel = (iso: string): string => {
    const at = new Date(iso);
    return Number.isNaN(at.getTime())
        ? '—'
        : at.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const sortByTs = (samples: Metric[]): Metric[] =>
    [...samples].sort((a, b) => new Date(a.ts).valueOf() - new Date(b.ts).valueOf());

interface MetricTooltipProps{
    active?: boolean;
    payload?: Array<{ payload: Metric }>;
}

const MetricTooltip = ({ active, payload }: MetricTooltipProps) => {
    const point = payload?.[0]?.payload;
    if(active !== true || point === undefined) return null;

    return (
        <ChartTooltip
            title={formatDate(point.ts)}
            rows={[
                { label: 'CPU', value: `${rate(point.cpuPercent)}%` },
                { label: 'Memory', value: `${rate(point.memPercent)}%` },
                { label: 'Used', value: formatBytes(point.memUsage) }
            ]}
        />
    );
};

interface UsageOverTimeProps{
    samples: Metric[];
}

const LEGEND = [
    { label: 'CPU %', className: 'bg-foreground' },
    { label: 'Memory %', className: 'bg-muted' }
];

const UsageOverTime = ({ samples }: UsageOverTimeProps) => (
    <ChartPanel title='Utilisation' meta={`${samples.length} ${samples.length === 1 ? 'sample' : 'samples'}`}>
        <div className='h-64'>
            <ResponsiveContainer width='100%' height='100%'>
                <AreaChart data={samples} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                    <XAxis dataKey='ts' tickFormatter={clockLabel} minTickGap={32} {...AXIS} />
                    <YAxis domain={[0, 100]} unit='%' width={44} {...AXIS} />
                    <Tooltip content={<MetricTooltip />} cursor={CURSOR} />
                    <Area
                        type='monotone'
                        dataKey='cpuPercent'
                        stroke='var(--foreground)'
                        strokeWidth={2}
                        fill='var(--foreground)'
                        fillOpacity={0.1}
                        dot={false}
                        activeDot={{ r: 4, fill: 'var(--foreground)', stroke: 'var(--background)', strokeWidth: 2 }}
                    />
                    <Area
                        type='monotone'
                        dataKey='memPercent'
                        stroke='var(--muted)'
                        strokeWidth={2}
                        fill='var(--muted)'
                        fillOpacity={0.08}
                        dot={false}
                        activeDot={{ r: 4, fill: 'var(--muted)', stroke: 'var(--background)', strokeWidth: 2 }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>

        <ChartLegend entries={LEGEND} />
    </ChartPanel>
);

const Metrics = () => {
    const repositories = useQuery(repositoryApi.mine, []);
    const itemsIds = useMemo(() => (repositories.data ?? []).map((entry) => entry.id), [repositories.data]);
    const [repositoryId, setRepositoryId] = useRememberedSelection<number>('metrics.repository', itemsIds);

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
                    isEmpty={latest === undefined}
                    empty={{
                        icon: Activity,
                        title: 'No samples yet',
                        description: 'This repository has no metric samples yet. Samples appear once its container starts reporting usage.'
                    }}
                >
                    {}
                    {latest !== undefined && (
                        <div className='flex flex-col gap-10'>
                            <StatBand columns={5}>
                                <StatTile label='CPU' value={`${rate(latest.cpuPercent)}%`} hint='Current sample'>
                                    <Sparkline values={samples.map((sample) => sample.cpuPercent)} />
                                </StatTile>

                                <StatTile
                                    label='Memory'
                                    value={`${rate(latest.memPercent)}%`}
                                    hint={`${formatBytes(latest.memUsage)} of ${formatBytes(latest.memLimit)}`}
                                >
                                    <Sparkline values={samples.map((sample) => sample.memPercent)} />
                                </StatTile>

                                <StatTile label='Network in' value={formatBytes(latest.netRx)} hint='Since start' />
                                <StatTile label='Network out' value={formatBytes(latest.netTx)} hint='Since start' />
                                <StatTile label='Processes' value={count(latest.pids)} hint='Running in the container' />
                            </StatBand>

                            <UsageOverTime samples={samples} />
                        </div>
                    )}
                </ListPageShell>
            </div>
        </PageBody>
    );
};

export default Metrics;
