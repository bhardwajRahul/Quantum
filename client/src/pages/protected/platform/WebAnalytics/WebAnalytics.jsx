import { useState, useEffect, useCallback, useRef } from 'react';
import { BarChart3 } from 'lucide-react';
import { PageHeader, StatCard, EmptyState, LoadingBlock, DataTable, Card, CardContent } from '@components/atoms/kit';
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from '@/components/ui/select';
import { analytics } from '@services/platform/service';

const POLL_MS = 15000;
const WINDOW_MINUTES = 1440;

const ALL_DOMAINS = '__all__';

const asArray = (res) => Array.isArray(res) ? res : (res?.data || []);

const asData = (res) => (res && res.data) ? res.data : (res || {});

const formatNumber = (n) => {
    const v = Number(n) || 0;
    if(v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if(v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return String(v);
};

const TopCard = ({ title, rows, labelHeader = 'Name', renderKey }) => (
    <Card>
        <CardContent className='p-5'>
            <h6 className='mb-3 text-sm font-semibold text-foreground'>{title}</h6>
            <DataTable
                columns={[
                    { key: 'key', header: labelHeader, render: (r) => renderKey ? renderKey(r.key) : (r.key || '—') },
                    { key: 'value', header: 'Views', align: 'right', render: (r) => formatNumber(r.value) }
                ]}
                rows={(rows || []).map((r, i) => ({ id: `${r.key}-${i}`, ...r }))}
                emptyText='No data yet.'
            />
        </CardContent>
    </Card>
);

const WebAnalytics = () => {
    const [domains, setDomains] = useState([]);
    const [domainId, setDomainId] = useState(ALL_DOMAINS);
    const [summary, setSummary] = useState(null);
    const [top, setTop] = useState(null);
    const [loadingDomains, setLoadingDomains] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const intervalRef = useRef(null);

    useEffect(() => {
        let active = true;
        (async () => {
            try{
                const res = await analytics.domains({});
                if(active) setDomains(asArray(res));
            }catch(err){
                if(active) setError(typeof err === 'string' ? err : 'Failed to load domains.');
            }finally{
                if(active) setLoadingDomains(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const fetchAnalytics = useCallback(async (id, withSpinner) => {
        if(withSpinner) setLoading(true);
        const queryParams = { minutes: WINDOW_MINUTES };
        if(id && id !== ALL_DOMAINS) queryParams.domainId = id;
        try{
            const [s, t] = await Promise.all([
                analytics.summary({ query: { queryParams } }),
                analytics.top({ query: { queryParams } })
            ]);
            setSummary(asData(s));
            setTop(asData(t));
            setError('');
        }catch(err){
            setError(typeof err === 'string' ? err : 'Failed to load analytics.');
        }finally{
            if(withSpinner) setLoading(false);
        }
    }, []);

    useEffect(() => {
        if(intervalRef.current){
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        fetchAnalytics(domainId, true);
        intervalRef.current = setInterval(() => fetchAnalytics(domainId, false), POLL_MS);
        return () => {
            if(intervalRef.current){
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [domainId, fetchAnalytics]);

    const hasData = summary && (summary.pageviews > 0 || summary.visitors > 0);

    const tiles = [
        { label: 'Visitors', value: formatNumber(summary?.visitors) },
        { label: 'Page views', value: formatNumber(summary?.pageviews) },
        { label: 'Bounce rate', value: `${summary?.bounceRate ?? 0}%` }
    ];

    return (
        <div>
            <PageHeader
                title='Web Analytics'
                subtitle='Real-time insights into your traffic.'
            />

            {error && <p className='mb-4 text-sm text-destructive'>{error}</p>}

            <div className='flex items-end justify-between gap-4 flex-wrap mb-6'>
                <div className='max-w-sm flex-1 min-w-[240px] space-y-1.5'>
                    <label className='text-sm font-medium'>Domain</label>
                    <Select
                        value={domainId}
                        disabled={loadingDomains}
                        onValueChange={(value) => setDomainId(value || ALL_DOMAINS)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder={loadingDomains ? 'Loading…' : 'All domains'} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_DOMAINS}>All domains</SelectItem>
                            {domains.map((d) => (
                                <SelectItem key={d._id} value={d._id}>{d.host || d._id}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <span className='text-xs text-muted-foreground'>
                    Last 24h · auto-refreshing every 15s
                </span>
            </div>

            {loading && !summary ? (
                <LoadingBlock label='Loading analytics' />
            ) : !hasData ? (
                <EmptyState
                    icon={BarChart3}
                    title='No traffic yet'
                    body='Traffic will appear here once visitors hit your domains.'
                />
            ) : (
                <div className='flex flex-col gap-8'>
                    <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                        {tiles.map(({ label, value }) => (
                            <StatCard key={label} label={label} value={value} />
                        ))}
                    </div>

                    <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                        <TopCard title='Top hostnames' rows={top?.hostnames} labelHeader='Host' />
                        <TopCard title='Top pages' rows={top?.paths} labelHeader='Path' />
                        <TopCard title='Referrers' rows={top?.referrers} labelHeader='Referrer' />
                        <TopCard title='Countries' rows={top?.countries} labelHeader='Country' />
                        <TopCard title='Devices' rows={top?.devices} labelHeader='Device' />
                        <TopCard title='Browsers' rows={top?.browsers} labelHeader='Browser' />
                        <TopCard title='Operating systems' rows={top?.os} labelHeader='OS' />
                        <Card>
                            <CardContent className='p-5'>
                                <h6 className='mb-3 text-sm font-semibold text-foreground'>UTM parameters</h6>
                                <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                                    <UtmList title='Source' rows={top?.utm?.source} />
                                    <UtmList title='Medium' rows={top?.utm?.medium} />
                                    <UtmList title='Campaign' rows={top?.utm?.campaign} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
};

const UtmList = ({ title, rows }) => (
    <div>
        <p className='mb-2 text-xs font-medium text-muted-foreground'>{title}</p>
        {(!rows || rows.length === 0) ? (
            <p className='text-xs text-muted-foreground'>—</p>
        ) : (
            <ul className='space-y-1'>
                {rows.map((r, i) => (
                    <li key={`${r.key}-${i}`} className='flex items-center justify-between gap-2 text-sm'>
                        <span className='truncate'>{r.key || '—'}</span>
                        <span className='tabular-nums text-muted-foreground'>{r.value}</span>
                    </li>
                ))}
            </ul>
        )}
    </div>
);

export default WebAnalytics;
