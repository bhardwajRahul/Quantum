import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity } from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import PageHeader from '@/shared/components/layout/PageHeader';
import ListPageShell from '@/shared/components/ListPageShell';
import StatTile from '@/shared/components/StatTile';
import StatBand from '@/shared/components/StatBand';
import ChartPanel from '@/shared/components/charts/ChartPanel';
import ChartLegend from '@/shared/components/charts/ChartLegend';
import ChartTooltip from '@/shared/components/charts/ChartTooltip';
import { AXIS, CURSOR, GRID_STROKE } from '@/shared/components/charts/axes';
import { useQuery } from '@/shared/hooks/api/use-query';
import { dockerApi } from '@/modules/docker/api/api';
import { formatBytes } from '@/shared/utils/format-bytes';
import { rate } from '@/shared/utils/format-metrics';
import type { NetworkUsageStat, ResourceUsageStat } from '@quantum/contracts/modules/docker/domain';

interface TimeWindow{
    label: string;
    minutes: number;
}

const WINDOWS: TimeWindow[] = [
    { label: 'Last 15 minutes', minutes: 15 },
    { label: 'Last hour', minutes: 60 },
    { label: 'Last 6 hours', minutes: 360 },
    { label: 'Last 24 hours', minutes: 1440 }
];

interface WindowSelectProps{
    value: number;
    onChange: (minutes: number) => void;
}

const WindowSelect = ({ value, onChange }: WindowSelectProps) => (
    <div role='group' aria-label='Time window' className='inline-flex h-9 max-w-full overflow-x-auto border border-border'>
        {WINDOWS.map((entry, index) => {
            const active = entry.minutes === value;

            return (
                <button
                    key={entry.minutes}
                    type='button'
                    aria-pressed={active}
                    onClick={() => onChange(entry.minutes)}
                    className={`label-caps shrink-0 whitespace-nowrap px-3.5 transition-colors ${index > 0 ? 'border-l border-border ' : ''}${active ? 'bg-foreground text-background' : 'text-muted hover:text-foreground'}`}
                >
                    {entry.label}
                </button>
            );
        })}
    </div>
);

interface NetworkTooltipProps{
    active?: boolean;
    payload?: Array<{ payload: NetworkUsageStat }>;
}

const NetworkTooltip = ({ active, payload }: NetworkTooltipProps) => {
    const point = payload?.[0]?.payload;
    if(active !== true || point === undefined) return null;

    return (
        <ChartTooltip
            title={point.projectName}
            rows={[
                { label: 'In', value: formatBytes(point.incoming) },
                { label: 'Out', value: formatBytes(point.outgoing) }
            ]}
        />
    );
};

interface ResourceTooltipProps{
    active?: boolean;
    payload?: Array<{ payload: ResourceUsageStat }>;
}

const ResourceTooltip = ({ active, payload }: ResourceTooltipProps) => {
    const point = payload?.[0]?.payload;
    if(active !== true || point === undefined) return null;

    return (
        <ChartTooltip
            title={point.projectName}
            rows={[
                { label: 'Avg CPU', value: `${rate(point.avgCpu)}%` },
                { label: 'Avg memory', value: formatBytes(point.avgMem) },
                { label: 'Peak memory', value: formatBytes(point.maxMem) }
            ]}
        />
    );
};

const NETWORK_LEGEND = [
    { label: 'Incoming', className: 'bg-foreground' },
    { label: 'Outgoing', className: 'bg-muted' }
];

interface NetworkChartProps{
    stats: NetworkUsageStat[];
}

const NetworkChart = ({ stats }: NetworkChartProps) => (
    <ChartPanel title='Network' meta={`${stats.length} ${stats.length === 1 ? 'project' : 'projects'}`}>
        <div style={{ height: Math.max(140, stats.length * 56) }}>
            <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={stats} layout='vertical' margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barGap={2}>
                    <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
                    <XAxis type='number' tickFormatter={formatBytes} {...AXIS} />
                    <YAxis type='category' dataKey='projectName' width={120} {...AXIS} />
                    <Tooltip content={<NetworkTooltip />} cursor={CURSOR} />
                    <Bar dataKey='incoming' fill='var(--foreground)' radius={[0, 4, 4, 0]} maxBarSize={24} />
                    <Bar dataKey='outgoing' fill='var(--muted)' radius={[0, 4, 4, 0]} maxBarSize={24} />
                </BarChart>
            </ResponsiveContainer>
        </div>

        <ChartLegend entries={NETWORK_LEGEND} />
    </ChartPanel>
);

interface ResourceChartProps{
    stats: ResourceUsageStat[];
}

const ResourceChart = ({ stats }: ResourceChartProps) => (
    <ChartPanel title='CPU' meta='Average over the window'>
        <div style={{ height: Math.max(140, stats.length * 44) }}>
            <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={stats} layout='vertical' margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barGap={2}>
                    <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
                    <XAxis type='number' unit='%' {...AXIS} />
                    <YAxis type='category' dataKey='projectName' width={120} {...AXIS} />
                    <Tooltip content={<ResourceTooltip />} cursor={CURSOR} />
                    <Bar dataKey='avgCpu' fill='var(--foreground)' radius={[0, 4, 4, 0]} maxBarSize={24} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    </ChartPanel>
);

const Usage = () => {
    const [minutes, setMinutes] = useState(WINDOWS[1].minutes);
    const network = useQuery((query: { minutes?: number }) => dockerApi.networkUsage({ query }), [{ minutes }]);
    const resources = useQuery((query: { minutes?: number }) => dockerApi.resourceUsage({ query }), [{ minutes }]);

    const retry = () => { network.reload(); resources.reload(); };
    const describe = () => 'Something went wrong loading usage data. Please try again.';

    if(network.loading || resources.loading || network.error !== undefined || resources.error !== undefined){
        return (
            <ListPageShell
                fill
                loading={network.loading || resources.loading}
                loadingTitle='Loading usage'
                error={network.error ?? resources.error}
                errorTitle='Could not load usage'
                getErrorDescription={describe}
                onRetry={retry}
            />
        );
    }

    const networkStats = network.data ?? [];
    const resourceStats = resources.data ?? [];

    const incoming = networkStats.reduce((total, stat) => total + stat.incoming, 0);
    const outgoing = networkStats.reduce((total, stat) => total + stat.outgoing, 0);
    const peakMemory = Math.max(0, ...resourceStats.map((stat) => stat.maxMem));
    const busiest = [...resourceStats].sort((a, b) => b.avgCpu - a.avgCpu)[0];

    return (
        <PageBody width='wide' height='full'>
            <PageHeader
                title='Usage'
                description='Network and resource usage across your projects.'
                filter={<WindowSelect value={minutes} onChange={setMinutes} />}
            />

            <div className='mt-6 flex flex-1 flex-col'>
                <ListPageShell
                    loadingTitle='Loading usage'
                    errorTitle='Could not load usage'
                    getErrorDescription={describe}
                    onRetry={retry}
                    isEmpty={networkStats.length === 0 && resourceStats.length === 0}
                    empty={{
                        icon: Activity,
                        title: 'No usage yet',
                        description: 'Usage data will appear here once your projects have running containers.'
                    }}
                >
                    <div className='flex flex-col gap-10'>
                        <StatBand columns={4}>
                            <StatTile label='Transferred in' value={formatBytes(incoming)} hint='Across all projects' />
                            <StatTile label='Transferred out' value={formatBytes(outgoing)} hint='Across all projects' />
                            <StatTile label='Peak memory' value={formatBytes(peakMemory)} hint='Highest of any project' />
                            <StatTile
                                label='Busiest project'
                                value={busiest === undefined ? '—' : `${rate(busiest.avgCpu)}%`}
                                hint={busiest?.projectName ?? 'No CPU samples'}
                            />
                        </StatBand>

                        <div className='grid gap-x-14 gap-y-10 lg:grid-cols-2'>
                            {networkStats.length > 0 && <NetworkChart stats={networkStats} />}
                            {resourceStats.length > 0 && <ResourceChart stats={resourceStats} />}
                        </div>
                    </div>
                </ListPageShell>
            </div>
        </PageBody>
    );
};

export default Usage;
