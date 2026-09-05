import { useEffect, useState } from 'react';
import { Chip } from '@heroui/react';
import { Activity } from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import PageHeader from '@/shared/components/layout/PageHeader';
import ListPageShell from '@/shared/components/ListPageShell';
import { useQuery } from '@/shared/hooks/api/use-query';
import { useChannel } from '@/shared/hooks/socket/use-channel';
import { activityApi } from '@/modules/activity/api/api';
import { activityLevelColor, activityLevelLabel } from '@/modules/activity/utils/level';
import { activityErrorMessages } from '@/modules/activity/utils/error-messages';
import { formatDate } from '@/shared/utils/format-date';
import { errorCopy } from '@/shared/utils/error-copy';
import type { ActivityEvent } from '@quantum/contracts/modules/activity/domain';

const copy = errorCopy(activityErrorMessages);

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
                <span className='shrink-0 text-[0.75rem] text-muted'>{formatDate(event.ts)}</span>
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
                    <ul className='flex flex-col'>
                        {events.map((event) => <EventRow key={event.id} event={event} />)}
                    </ul>
                </ListPageShell>
            </div>
        </PageBody>
    );
};

export default Events;
