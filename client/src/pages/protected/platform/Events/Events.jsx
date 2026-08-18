import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Rss, RefreshCw } from 'lucide-react';
import { PageHeader, DataTable, StatusBadge, Pill, EmptyState, Button } from '@components/atoms/kit';
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from '@/components/ui/select';
import { activity as activityService } from '@services/platform/service';
import * as activitySlice from '@services/activity/slice';

const LEVEL_TONE = {
    success: 'green',
    progress: 'amber',
    warn: 'amber',
    error: 'red',
    info: 'gray'
};

const SCOPE_OPTIONS = [
    { value: 'all', label: 'All scopes' },
    { value: 'deploy', label: 'Deploy' },
    { value: 'build', label: 'Build' },
    { value: 'database', label: 'Database' },
    { value: 'codespace', label: 'Codespace' },
    { value: 'http', label: 'HTTP' },
    { value: 'system', label: 'System' }
];

const relativeTime = (ts) => {
    if(!ts) return '—';
    const then = new Date(ts).getTime();
    if(Number.isNaN(then)) return '—';
    const diff = Math.max(0, Date.now() - then);
    const s = Math.floor(diff / 1000);
    if(s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if(m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if(h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
};

const Events = () => {
    const dispatch = useDispatch();
    const events = useSelector((state) => state.activity.events);
    const [scope, setScope] = useState('all');
    const [refreshing, setRefreshing] = useState(false);

    const [, setTick] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 15000);
        return () => clearInterval(id);
    }, []);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        try{
            const res = await activityService.list({ query: { queryParams: { limit: 100 } } });
            const arr = Array.isArray(res) ? res : (res?.data || []);
            dispatch(activitySlice.setActivities(arr));
        }catch{   }
        finally{ setRefreshing(false); }
    }, [dispatch]);

    useEffect(() => {
        if(events.length === 0) refresh();

    }, []);

    const rows = useMemo(() => {
        const filtered = scope === 'all' ? events : events.filter((e) => e.scope === scope);
        return filtered.map((e, i) => ({ ...e, _key: e._id || e.correlationId ? `${e._id || e.correlationId}-${i}` : `${e.ts}-${i}` }));
    }, [events, scope]);

    const columns = [
        {
            key: 'ts',
            header: 'Time',
            render: (row) => <span className='text-muted-foreground tabular-nums'>{relativeTime(row.ts)}</span>
        },
        {
            key: 'scope',
            header: 'Scope',
            render: (row) => <Pill>{row.scope || '—'}</Pill>
        },
        {
            key: 'title',
            header: 'Activity',
            render: (row) => (
                <div className='min-w-0'>
                    <div className='flex items-center gap-2'>
                        {Number.isInteger(row.meta?.stepIndex) && (
                            <span className='text-xs text-muted-foreground/60 tabular-nums'>#{row.meta.stepIndex}</span>
                        )}
                        <span className='truncate text-foreground'>{row.title || '—'}</span>
                    </div>
                    {row.message && (
                        <p className='mt-0.5 truncate text-xs text-muted-foreground'>{row.message}</p>
                    )}
                </div>
            )
        },
        {
            key: 'level',
            header: 'Status',
            render: (row) => <StatusBadge status={row.level || 'info'} tone={LEVEL_TONE[row.level] || 'gray'} />
        }
    ];

    return (
        <div>
            <PageHeader
                title='Events'
                subtitle='Real-time activity across your platform.'
                actions={(
                    <div className='flex items-center gap-2'>
                        <Select value={scope} onValueChange={(v) => setScope(v || 'all')}>
                            <SelectTrigger className='w-[150px]'>
                                <SelectValue placeholder='All scopes' />
                            </SelectTrigger>
                            <SelectContent>
                                {SCOPE_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant='outline' size='sm' onClick={refresh} disabled={refreshing}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                )}
            />

            {rows.length === 0 ? (
                <EmptyState
                    icon={Rss}
                    title='No activity yet'
                    body='Deployments, builds, database operations and other platform events will stream in here as they happen.'
                />
            ) : (
                <DataTable columns={columns} rows={rows} getRowKey={(row) => row._key} />
            )}
        </div>
    );
};

export default Events;
