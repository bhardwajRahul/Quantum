import { useState } from 'react';
import { Card, ListBox, ListBoxItem, Select, Table } from '@heroui/react';
import { Inbox } from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import LoadingState from '@/shared/components/LoadingState';
import ErrorState from '@/shared/components/ErrorState';
import EmptyState from '@/shared/components/EmptyState';
import CenterState from '@/shared/components/CenterState';
import { useQuery } from '@/shared/hooks/api/use-query';
import { usePolledQuery } from '@/shared/hooks/api/use-polled-query';
import { analyticsApi } from '@/modules/analytics/api/api';
import type { TopEntry, DomainStat } from '@quantum/contracts/modules/analytics/domain';

const WINDOW_OPTIONS = [
    { id: 60, label: 'Last hour' },
    { id: 1440, label: 'Last 24 hours' },
    { id: 10080, label: 'Last 7 days' }
];

const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`;

interface WindowSelectProps{
    value: number;
    onChange: (minutes: number) => void;
}

const WindowSelect = ({ value, onChange }: WindowSelectProps) => (
    <Select
        aria-label='Time window'
        selectedKey={value}
        onSelectionChange={(key) => onChange(Number(key))}
    >
        <Select.Trigger>
            <Select.Value>Time window</Select.Value>
            <Select.Indicator />
        </Select.Trigger>

        <Select.Popover>
            <ListBox>
                {WINDOW_OPTIONS.map((option) => (
                    <ListBoxItem key={option.id} id={option.id} textValue={option.label}>
                        {option.label}
                    </ListBoxItem>
                ))}
            </ListBox>
        </Select.Popover>
    </Select>
);

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

interface TopTableProps{
    title: string;
    keyLabel: string;
    entries: TopEntry[];
}

const TopTable = ({ title, keyLabel, entries }: TopTableProps) => (
    <Card>
        <Card.Header>
            <Card.Title>{title}</Card.Title>
        </Card.Header>
        <Card.Content>
            {entries.length === 0 ? (
                <CenterState>
                    <EmptyState icon={Inbox} title='No data yet' compact />
                </CenterState>
            ) : (
                <Table>
                    <Table.ScrollContainer>
                        <Table.Content aria-label={title}>
                            <Table.Header>
                                <Table.Column isRowHeader>{keyLabel}</Table.Column>
                                <Table.Column>Count</Table.Column>
                            </Table.Header>
                            <Table.Body>
                                {entries.map((entry) => (
                                    <Table.Row key={entry.key}>
                                        <Table.Cell>{entry.key}</Table.Cell>
                                        <Table.Cell>{entry.value}</Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table.Content>
                    </Table.ScrollContainer>
                </Table>
            )}
        </Card.Content>
    </Card>
);

interface UtmTableProps{
    source: TopEntry[];
    medium: TopEntry[];
    campaign: TopEntry[];
}

const UtmTable = ({ source, medium, campaign }: UtmTableProps) => {
    const rows = [
        ...source.map((entry) => ({ type: 'Source', ...entry })),
        ...medium.map((entry) => ({ type: 'Medium', ...entry })),
        ...campaign.map((entry) => ({ type: 'Campaign', ...entry }))
    ];

    return (
        <Card>
            <Card.Header>
                <Card.Title>UTM</Card.Title>
            </Card.Header>
            <Card.Content>
                {rows.length === 0 ? (
                    <CenterState>
                    <EmptyState icon={Inbox} title='No data yet' compact />
                </CenterState>
                ) : (
                    <Table>
                        <Table.ScrollContainer>
                            <Table.Content aria-label='UTM'>
                                <Table.Header>
                                    <Table.Column isRowHeader>Type</Table.Column>
                                    <Table.Column>Value</Table.Column>
                                    <Table.Column>Count</Table.Column>
                                </Table.Header>
                                <Table.Body>
                                    {rows.map((row, index) => (
                                        <Table.Row key={`${row.type}-${row.key}-${index}`}>
                                            <Table.Cell>{row.type}</Table.Cell>
                                            <Table.Cell>{row.key}</Table.Cell>
                                            <Table.Cell>{row.value}</Table.Cell>
                                        </Table.Row>
                                    ))}
                                </Table.Body>
                            </Table.Content>
                        </Table.ScrollContainer>
                    </Table>
                )}
            </Card.Content>
        </Card>
    );
};

interface DomainsTableProps{
    domains: DomainStat[];
}

const DomainsTable = ({ domains }: DomainsTableProps) => (
    <Card>
        <Card.Header>
            <Card.Title>Domains</Card.Title>
        </Card.Header>
        <Card.Content>
            {domains.length === 0 ? (
                <CenterState>
                    <EmptyState icon={Inbox} title='No data yet' compact />
                </CenterState>
            ) : (
                <Table>
                    <Table.ScrollContainer>
                        <Table.Content aria-label='Domains'>
                            <Table.Header>
                                <Table.Column isRowHeader>Host</Table.Column>
                                <Table.Column>Pageviews</Table.Column>
                            </Table.Header>
                            <Table.Body>
                                {domains.map((domain) => (
                                    <Table.Row key={domain.host}>
                                        <Table.Cell>{domain.host}</Table.Cell>
                                        <Table.Cell>{domain.pageviews}</Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table.Content>
                    </Table.ScrollContainer>
                </Table>
            )}
        </Card.Content>
    </Card>
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

    if(summary.loading || top.loading || domains.loading){
        return <LoadingState title='Loading analytics' compact />;
    }

    if(summary.error !== undefined || top.error !== undefined || domains.error !== undefined){
        return (
            <ErrorState
                title='Could not load analytics'
                description='Something went wrong while loading analytics.'
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
            <div className='flex items-center justify-between gap-4'>
                <div>
                    <h1 className='text-lg font-medium text-foreground'>Analytics</h1>
                    <p className='mt-1.5 text-sm text-muted'>
                        Traffic across all domains. Refreshes automatically every 15 seconds.
                    </p>
                </div>

                <div className='w-48'>
                    <WindowSelect value={minutes} onChange={setMinutes} />
                </div>
            </div>

            <div className='mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4'>
                <StatTile label='Pageviews' value={String(summaryData.pageviews)} />
                <StatTile label='Visitors' value={String(summaryData.visitors)} />
                <StatTile label='Bounces' value={String(summaryData.bounces)} />
                <StatTile label='Bounce rate' value={formatPercent(summaryData.bounceRate)} />
            </div>

            <div className='mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                <TopTable title='Hostnames' keyLabel='Host' entries={topData.hostnames} />
                <TopTable title='Paths' keyLabel='Path' entries={topData.paths} />
                <TopTable title='Referrers' keyLabel='Referrer' entries={topData.referrers} />
                <TopTable title='Countries' keyLabel='Country' entries={topData.countries} />
                <TopTable title='Devices' keyLabel='Device' entries={topData.devices} />
                <TopTable title='Browsers' keyLabel='Browser' entries={topData.browsers} />
                <TopTable title='OS' keyLabel='OS' entries={topData.os} />
                <UtmTable
                    source={topData.utm.source}
                    medium={topData.utm.medium}
                    campaign={topData.utm.campaign}
                />
            </div>

            <div className='mt-6'>
                <DomainsTable domains={domainsData} />
            </div>
        </PageBody>
    );
};

export default WebAnalytics;
