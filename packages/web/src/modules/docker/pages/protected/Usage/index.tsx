import { useState } from 'react';
import { ListBox, ListBoxItem, Select } from '@heroui/react';
import { Activity } from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import LoadingState from '@/shared/components/LoadingState';
import ErrorState from '@/shared/components/ErrorState';
import EmptyState from '@/shared/components/EmptyState';
import { useQuery } from '@/shared/hooks/api/use-query';
import { dockerApi } from '@/modules/docker/api/api';
import { formatBytes } from '@/modules/docker/utils/format';
import type { NetworkUsageStat, ResourceUsageStat } from '@quantum/contracts/modules/docker/domain';

interface TimeWindow{
    label: string;
    minutes: number;
}

const WINDOWS: TimeWindow[] = [
    { label: '15m', minutes: 15 },
    { label: '1h', minutes: 60 },
    { label: '6h', minutes: 360 },
    { label: '24h', minutes: 1440 }
];

interface WindowSelectProps{
    value: number;
    onChange: (minutes: number) => void;
}

const WindowSelect = ({ value, onChange }: WindowSelectProps) => (
    <Select aria-label='Time window' selectedKey={value} onSelectionChange={(key) => onChange(Number(key))}>
        <Select.Trigger>
            <Select.Value>{WINDOWS.find((entry) => entry.minutes === value)?.label}</Select.Value>
            <Select.Indicator />
        </Select.Trigger>

        <Select.Popover>
            <ListBox>
                {WINDOWS.map((entry) => (
                    <ListBoxItem key={entry.minutes} id={entry.minutes} textValue={entry.label}>
                        {entry.label}
                    </ListBoxItem>
                ))}
            </ListBox>
        </Select.Popover>
    </Select>
);

interface UsageHeaderProps{
    minutes: number;
    onChangeWindow: (minutes: number) => void;
}

const UsageHeader = ({ minutes, onChangeWindow }: UsageHeaderProps) => (
    <div className='flex items-center justify-between gap-4'>
        <div>
            <h1 className='text-lg font-medium text-foreground'>Usage</h1>
            <p className='mt-1.5 text-sm text-muted'>Network and resource usage across your projects.</p>
        </div>

        <WindowSelect value={minutes} onChange={onChangeWindow} />
    </div>
);

interface NetworkBarProps{
    stat: NetworkUsageStat;
    max: number;
}

const NetworkBar = ({ stat, max }: NetworkBarProps) => (
    <div className='flex flex-col gap-1.5 py-3'>
        <p className='text-sm font-medium text-foreground'>{stat.projectName}</p>

        <div className='flex items-center gap-2'>
            <span className='w-16 shrink-0 text-xs text-muted'>In</span>
            <div className='h-2 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]'>
                <div
                    className='h-full rounded-full bg-foreground/70'
                    style={{ width: `${max === 0 ? 0 : (stat.incoming / max) * 100}%` }}
                />
            </div>
            <span className='w-20 shrink-0 text-right text-xs text-muted'>{formatBytes(stat.incoming)}</span>
        </div>

        <div className='flex items-center gap-2'>
            <span className='w-16 shrink-0 text-xs text-muted'>Out</span>
            <div className='h-2 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]'>
                <div
                    className='h-full rounded-full bg-foreground/30'
                    style={{ width: `${max === 0 ? 0 : (stat.outgoing / max) * 100}%` }}
                />
            </div>
            <span className='w-20 shrink-0 text-right text-xs text-muted'>{formatBytes(stat.outgoing)}</span>
        </div>
    </div>
);

interface NetworkUsageSectionProps{
    stats: NetworkUsageStat[];
}

const NetworkUsageSection = ({ stats }: NetworkUsageSectionProps) => {
    const max = Math.max(0, ...stats.flatMap((stat) => [stat.incoming, stat.outgoing]));

    return (
        <section className='rounded-xl bg-foreground/[0.04] p-5'>
            <h2 className='text-[0.9375rem] font-medium text-foreground'>Network</h2>

            <div className='mt-1 divide-y divide-foreground/[0.06]'>
                {stats.map((stat) => (
                    <NetworkBar key={stat.projectId} stat={stat} max={max} />
                ))}
            </div>
        </section>
    );
};

interface ResourceCardProps{
    stat: ResourceUsageStat;
}

const ResourceCard = ({ stat }: ResourceCardProps) => (
    <div className='rounded-xl bg-foreground/[0.04] p-5'>
        <p className='text-sm font-medium text-foreground'>{stat.projectName}</p>

        <dl className='mt-3 grid grid-cols-3 gap-3'>
            <div>
                <dt className='text-xs text-muted'>Avg CPU</dt>
                <dd className='mt-0.5 text-sm text-foreground'>{stat.avgCpu.toFixed(1)}%</dd>
            </div>
            <div>
                <dt className='text-xs text-muted'>Avg Mem</dt>
                <dd className='mt-0.5 text-sm text-foreground'>{formatBytes(stat.avgMem)}</dd>
            </div>
            <div>
                <dt className='text-xs text-muted'>Max Mem</dt>
                <dd className='mt-0.5 text-sm text-foreground'>{formatBytes(stat.maxMem)}</dd>
            </div>
        </dl>
    </div>
);

interface ResourceUsageSectionProps{
    stats: ResourceUsageStat[];
}

const ResourceUsageSection = ({ stats }: ResourceUsageSectionProps) => (
    <section>
        <h2 className='text-[0.9375rem] font-medium text-foreground'>Resources</h2>

        <div className='mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {stats.map((stat) => (
                <ResourceCard key={stat.projectId} stat={stat} />
            ))}
        </div>
    </section>
);

const Usage = () => {
    const [minutes, setMinutes] = useState(WINDOWS[1].minutes);
    const network = useQuery(dockerApi.networkUsage, [{ minutes }]);
    const resources = useQuery(dockerApi.resourceUsage, [{ minutes }]);

    if(network.loading || resources.loading) return <LoadingState title='Loading usage' compact />;

    const error = network.error ?? resources.error;
    if(error !== undefined){
        return (
            <ErrorState
                title='Could not load usage'
                description='Something went wrong loading usage data. Please try again.'
                onRetry={() => { network.reload(); resources.reload(); }}
            />
        );
    }

    const networkStats = network.data ?? [];
    const resourceStats = resources.data ?? [];

    return (
        <PageBody width='wide'>
            <UsageHeader minutes={minutes} onChangeWindow={setMinutes} />

            <div className='mt-6'>
                {networkStats.length === 0 && resourceStats.length === 0 ? (
                    <EmptyState
                        icon={Activity}
                        title='No usage yet'
                        description='Usage data will appear here once your projects have running containers.'
                    />
                ) : (
                    <div className='flex flex-col gap-6'>
                        {networkStats.length > 0 && <NetworkUsageSection stats={networkStats} />}
                        {resourceStats.length > 0 && <ResourceUsageSection stats={resourceStats} />}
                    </div>
                )}
            </div>
        </PageBody>
    );
};

export default Usage;
