import { useState } from 'react';
import PageBody from '@/shared/components/layout/PageBody';
import PageHeader from '@/shared/components/layout/PageHeader';
import ListPageShell from '@/shared/components/ListPageShell';
import StatTile from '@/shared/components/StatTile';
import StatBand from '@/shared/components/StatBand';
import TopList from '@/shared/components/charts/TopList';
import { formatPercent } from '@/shared/utils/format-percent';
import { count } from '@/shared/utils/format-metrics';
import { useQuery } from '@/shared/hooks/api/use-query';
import { usePolledQuery } from '@/shared/hooks/api/use-polled-query';
import { analyticsApi } from '@/modules/analytics/api/api';

const WINDOW_OPTIONS = [
    { id: 60, label: 'Last hour' },
    { id: 1440, label: 'Last 24 hours' },
    { id: 10080, label: 'Last 7 days' }
];

interface WindowSelectProps{
    value: number;
    onChange: (minutes: number) => void;
}

const WindowSelect = ({ value, onChange }: WindowSelectProps) => (
    <div role='group' aria-label='Time window' className='inline-flex h-9 max-w-full overflow-x-auto border border-border'>
        {WINDOW_OPTIONS.map((option, index) => {
            const active = option.id === value;

            return (
                <button
                    key={option.id}
                    type='button'
                    aria-pressed={active}
                    onClick={() => onChange(option.id)}
                    className={`label-caps shrink-0 whitespace-nowrap px-3.5 transition-colors ${index > 0 ? 'border-l border-border ' : ''}${active ? 'bg-foreground text-background' : 'text-muted hover:text-foreground'}`}
                >
                    {option.label}
                </button>
            );
        })}
    </div>
);

const WebAnalytics = () => {
    const [minutes, setMinutes] = useState(1440);

    const summary = usePolledQuery(
        useQuery((query: { minutes?: number; domainId?: number }) => analyticsApi.summary({ query }), [{ minutes, domainId: undefined }]),
        { while: (data) => data !== null, everyMs: 15000 }
    );
    const top = usePolledQuery(
        useQuery((query: { minutes?: number; domainId?: number }) => analyticsApi.top({ query }), [{ minutes, domainId: undefined }]),
        { while: (data) => data !== null, everyMs: 15000 }
    );
    const domains = usePolledQuery(
        useQuery((query: { minutes?: number; domainId?: number }) => analyticsApi.domains({ query }), [{ minutes, domainId: undefined }]),
        { while: (data) => data !== null, everyMs: 15000 }
    );

    if(summary.loading || top.loading || domains.loading || summary.error !== undefined || top.error !== undefined || domains.error !== undefined){
        return (
            <ListPageShell
                bare
                loading={summary.loading || top.loading || domains.loading}
                loadingTitle='Loading analytics'
                error={summary.error ?? top.error ?? domains.error}
                errorTitle='Could not load analytics'
                getErrorDescription={() => 'Something went wrong while loading analytics.'}
                onRetry={() => {
                    summary.reload();
                    top.reload();
                    domains.reload();
                }}
            />
        );
    }

    const summaryData = summary.data!;
    const topData = top.data!;
    const domainsData = domains.data!;

    return (
        <PageBody width='wide'>
            <PageHeader
                title='Analytics'
                description='Traffic across all domains. Refreshes automatically every 15 seconds.'
                filter={<WindowSelect value={minutes} onChange={setMinutes} />}
            />

            <div className='mt-6'>
                <StatBand columns={4}>
                    <StatTile label='Pageviews' value={count(summaryData.pageviews)} hint='In this window' />
                    <StatTile label='Visitors' value={count(summaryData.visitors)} hint='Unique in this window' />
                    <StatTile label='Bounces' value={count(summaryData.bounces)} hint='Single-page visits' />
                    <StatTile
                        label='Bounce rate'
                        value={formatPercent(summaryData.bounceRate)}
                        hint={`of ${count(summaryData.visitors)} visitors`}
                    />
                </StatBand>
            </div>

            <div className='mt-10 grid gap-x-14 gap-y-10 lg:grid-cols-2'>
                <TopList title='Pages' entries={topData.paths} />
                <TopList title='Referrers' entries={topData.referrers} emptyLabel='All traffic was direct' />
                <TopList title='Countries' entries={topData.countries} />
                <TopList title='Browsers' entries={topData.browsers} />
                <TopList title='Devices' entries={topData.devices} />
                <TopList title='Operating systems' entries={topData.os} />
                <TopList title='Hostnames' entries={topData.hostnames} />
                <TopList
                    title='Domains'
                    entries={domainsData.map((domain) => ({ key: domain.host, value: domain.pageviews }))}
                />
            </div>

            {}
            {(topData.utm.source.length > 0 || topData.utm.medium.length > 0 || topData.utm.campaign.length > 0) && (
                <div className='mt-10 grid gap-x-14 gap-y-10 lg:grid-cols-3'>
                    <TopList title='UTM source' entries={topData.utm.source} />
                    <TopList title='UTM medium' entries={topData.utm.medium} />
                    <TopList title='UTM campaign' entries={topData.utm.campaign} />
                </div>
            )}

        </PageBody>
    );
};

export default WebAnalytics;
