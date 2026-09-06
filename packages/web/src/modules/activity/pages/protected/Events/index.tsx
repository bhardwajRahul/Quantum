import { useEffect, useState } from 'react';
import { Table } from '@heroui/react';
import { Activity } from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import PageHeader from '@/shared/components/layout/PageHeader';
import ListPageShell from '@/shared/components/ListPageShell';
import StatusDot from '@/shared/components/StatusDot';
import { useQuery } from '@/shared/hooks/api/use-query';
import { useChannel } from '@/shared/hooks/socket/use-channel';
import { activityApi } from '@/modules/activity/api/api';
import { activityLevelColor, activityLevelLabel } from '@/modules/activity/utils/level';
import { activityErrorMessages } from '@/modules/activity/utils/error-messages';
import { formatDate } from '@/shared/utils/format-date';
import { errorCopy } from '@/shared/utils/error-copy';
import { ActivityLevel } from '@quantum/contracts/modules/activity/domain';
import type { ActivityEvent } from '@quantum/contracts/modules/activity/domain';

const copy = errorCopy(activityErrorMessages);

interface EventsTableProps{
    events: ActivityEvent[];
}

const EventsTable = ({ events }: EventsTableProps) => (
    <Table>
        <Table.ScrollContainer>
            <Table.Content aria-label='Events'>
                <Table.Header>
                    <Table.Column>Level</Table.Column>
                    <Table.Column isRowHeader>Event</Table.Column>
                    <Table.Column>Source</Table.Column>
                    <Table.Column>Time</Table.Column>
                </Table.Header>

                <Table.Body>
                    {events.map((event) => (
                        <Table.Row key={event.id}>
                            <Table.Cell>
                                <StatusDot
                                    color={activityLevelColor(event.level)}
                                    label={activityLevelLabel(event.level)}
                                    isTransient={event.level === ActivityLevel.Progress}
                                />
                            </Table.Cell>

                            <Table.Cell>
                                <div className='flex max-w-[560px] flex-col gap-0.5'>
                                    <span className='font-medium text-foreground'>{event.title}</span>
                                    {}
                                    {event.message !== '' && (
                                        <span className='break-words text-[0.8125rem] text-muted'>{event.message}</span>
                                    )}
                                </div>
                            </Table.Cell>

                            <Table.Cell>
                                <span className='text-[0.8125rem] text-muted'>{event.source ?? '—'}</span>
                            </Table.Cell>

                            <Table.Cell>{formatDate(event.ts)}</Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table.Content>
        </Table.ScrollContainer>
    </Table>
);

const Events = () => {
    const history = useQuery(activityApi.list, []);
    const [events, setEvents] = useState<ActivityEvent[]>([]);

    useEffect(() => {
        if(history.data) setEvents(history.data.items);
    }, [history.data]);

    const channel = useChannel('/activity/stream', {
        'activity.created': (event) => setEvents((previous) => [event, ...previous])
    });

    useEffect(() => {
        if(channel.status === 'open') channel.send('subscribe', {});
    }, [channel]);

    if(history.loading || history.error !== undefined){
        return (
            <ListPageShell
                fill
                loading={history.loading}
                loadingTitle='Loading events'
                error={history.error}
                errorTitle='Could not load events'
                getErrorDescription={copy}
                onRetry={history.reload}
            />
        );
    }

    return (
        <PageBody width='wide' height='full'>
            <PageHeader
                title='Events'
                description='Live activity across your organization, updated in real time.'
            />

            <div className='mt-6 flex flex-1 flex-col'>
                <ListPageShell
                    loadingTitle='Loading events'
                    errorTitle='Could not load events'
                    getErrorDescription={copy}
                    onRetry={history.reload}
                    isEmpty={events.length === 0}
                    empty={{
                        icon: Activity,
                        title: 'No events yet',
                        description: 'Activity from your organization will show up here as it happens.'
                    }}
                >
                    <EventsTable events={events} />
                </ListPageShell>
            </div>
        </PageBody>
    );
};

export default Events;
