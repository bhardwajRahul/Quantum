import { useEffect, useState } from 'react';
import { Chip } from '@heroui/react';
import { Activity } from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import LoadingState from '@/shared/components/LoadingState';
import ErrorState from '@/shared/components/ErrorState';
import EmptyState from '@/shared/components/EmptyState';
import CenterState from '@/shared/components/CenterState';
import { useQuery } from '@/shared/hooks/api/use-query';
import { useChannel } from '@/shared/hooks/socket/use-channel';
import { activityApi } from '@/modules/activity/api/api';
import { activityLevelColor, activityLevelLabel } from '@/modules/activity/utils/level';
import { errorCopy } from '@/shared/utils/error-copy';
import type { ActivityEvent } from '@quantum/contracts/modules/activity/domain';

const copy = errorCopy({});

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

const formatTimestamp = (iso: string): string => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
};

interface EventRowProps{
    event: ActivityEvent;
}

const EventRow = ({ event }: EventRowProps) => (
    <li className='flex gap-3 border-b border-foreground/[0.06] py-3 last:border-0'>
        <Chip size='sm' variant='soft' color={activityLevelColor(event.level)}>
            {activityLevelLabel(event.level)}
        </Chip>

        <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
            <div className='flex items-baseline justify-between gap-3'>
                <span className='truncate font-medium text-foreground'>{event.title}</span>
                <span className='shrink-0 text-[0.75rem] text-muted'>{formatTimestamp(event.ts)}</span>
            </div>
            <p className='text-[0.875rem] text-muted'>{event.message}</p>
            {event.source && <span className='text-[0.75rem] text-muted'>{event.source}</span>}
        </div>
    </li>
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
        channel.send('subscribe', {});
    }, [channel.send]);

    if(history.loading) return <CenterState className='h-full'><LoadingState title='Loading events' compact /></CenterState>;
    if(history.error !== undefined){
        return (
            <CenterState className='h-full'>
                <ErrorState
                    title='Could not load events'
                    description={copy(history.error)}
                    onRetry={history.reload}
                />
            </CenterState>
        );
    }

    return (
        <PageBody width='wide' height='full'>
            <div>
                <h1 className='text-lg font-medium text-foreground'>Events</h1>
                <p className='mt-1.5 text-sm text-muted'>Live activity across your organization, updated in real time.</p>
            </div>

            <div className='mt-6 flex flex-1 flex-col'>
                {events.length === 0 ? (
                    <CenterState>
                        <EmptyState
                            icon={Activity}
                            title='No events yet'
                            description='Activity from your organization will show up here as it happens.'
                        />
                    </CenterState>
                ) : (
                    <ul className='flex flex-col'>
                        {events.map((event) => <EventRow key={event.id} event={event} />)}
                    </ul>
                )}
            </div>
        </PageBody>
    );
};

export default Events;
