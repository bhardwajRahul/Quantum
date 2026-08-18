import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { PageHeader, StatCard, EmptyState, LoadingBlock, Card, CardContent } from '@components/atoms/kit';
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from '@/components/ui/select';
import { usage } from '@services/platform/service';
import useTenancy from '@hooks/common/useTenancy';
import { formatBytes } from '@utilities/common/formatBytes';

const asArray = (res) => Array.isArray(res) ? res : (res?.data || []);

const pct = (n) => `${Math.max(0, Number(n) || 0).toFixed(1)}%`;

const WINDOWS = [
    { value: '60', label: 'Last hour' },
    { value: '360', label: 'Last 6 hours' },
    { value: '1440', label: 'Last 24 hours' },
    { value: '10080', label: 'Last 7 days' }
];

const TransferChart = ({ rows }) => {
    const max = Math.max(1, ...rows.flatMap((r) => [Number(r.incoming) || 0, Number(r.outgoing) || 0]));
    return (
        <div className='flex flex-col gap-5'>

            <div className='flex items-center gap-5 text-xs text-muted-foreground'>
                <span className='inline-flex items-center gap-1.5'>
                    <span className='h-2 w-2 rounded-sm bg-primary' /> Incoming
                </span>
                <span className='inline-flex items-center gap-1.5'>
                    <span className='h-2 w-2 rounded-sm bg-success' /> Outgoing
                </span>
            </div>

            {rows.map((r) => (
                <div key={r.projectId} className='space-y-1.5'>
                    <div className='flex items-center justify-between text-sm'>
                        <span className='font-medium text-foreground truncate'>{r.projectName}</span>
                    </div>

                    <div className='flex items-center gap-2'>
                        <ArrowDownToLine className='h-3.5 w-3.5 flex-none text-primary' />
                        <div className='h-3 flex-1 rounded-sm bg-muted/40'>
                            <div
                                className='h-3 rounded-sm bg-primary'
                                style={{ width: `${Math.max(2, ((Number(r.incoming) || 0) / max) * 100)}%` }}
                            />
                        </div>
                        <span className='w-20 flex-none text-right text-xs tabular-nums text-muted-foreground'>
                            {formatBytes(r.incoming)}
                        </span>
                    </div>

                    <div className='flex items-center gap-2'>
                        <ArrowUpFromLine className='h-3.5 w-3.5 flex-none text-success' />
                        <div className='h-3 flex-1 rounded-sm bg-muted/40'>
                            <div
                                className='h-3 rounded-sm bg-success'
                                style={{ width: `${Math.max(2, ((Number(r.outgoing) || 0) / max) * 100)}%` }}
                            />
                        </div>
                        <span className='w-20 flex-none text-right text-xs tabular-nums text-muted-foreground'>
                            {formatBytes(r.outgoing)}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
};

const Usage = () => {
    const { organizationId } = useTenancy();
    const [minutes, setMinutes] = useState('1440');
    const [network, setNetwork] = useState([]);
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchUsage = useCallback(async (mins) => {
        setLoading(true);
        try{
            const [net, resrc] = await Promise.all([
                usage.network({ query: { queryParams: { minutes: mins } } }),
                usage.resources({ query: { queryParams: { minutes: mins } } })
            ]);
            setNetwork(asArray(net));
            setResources(asArray(resrc));
            setError('');
        }catch(err){
            setError(typeof err === 'string' ? err : 'Failed to load usage.');
        }finally{
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsage(minutes);
    }, [minutes, organizationId, fetchUsage]);

    const hasData = network.length > 0 || resources.length > 0;

    return (
        <div>
            <PageHeader
                title='Usage'
                subtitle='Network transfer and resource usage across your projects.'
            />

            {error && (
                <p className='mb-4 text-sm text-destructive'>{error}</p>
            )}

            <div className='flex items-end justify-between gap-4 flex-wrap mb-6'>
                <div className='max-w-xs flex-1 min-w-[200px] space-y-1.5'>
                    <label className='text-sm font-medium'>Window</label>
                    <Select value={minutes} onValueChange={(value) => setMinutes(value || '1440')}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {WINDOWS.map((w) => (
                                <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {loading && !hasData ? (
                <LoadingBlock label='Loading usage' />
            ) : !hasData ? (
                <EmptyState
                    icon={TrendingUp}
                    title='No usage yet'
                    body='Usage data appears once your project containers have been running and metrics have been sampled.'
                />
            ) : (
                <div className='flex flex-col gap-8'>
                    {network.length > 0 && (
                        <Card>
                            <CardContent className='p-5'>
                                <h6 className='mb-5 text-sm font-semibold text-foreground'>
                                    Network transfer per project
                                </h6>
                                <TransferChart rows={network} />
                            </CardContent>
                        </Card>
                    )}

                    {resources.length > 0 && (
                        <div>
                            <h6 className='mb-4 text-sm font-semibold text-foreground'>
                                Resource usage per project
                            </h6>
                            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6'>
                                {resources.map((r) => (
                                    <Card key={r.projectId}>
                                        <CardContent className='p-5'>
                                            <p className='mb-4 text-sm font-medium text-foreground truncate'>{r.projectName}</p>
                                            <div className='grid grid-cols-3 gap-4'>
                                                <StatCard label='Avg CPU' value={pct(r.avgCpu)} />
                                                <StatCard label='Avg mem' value={pct(r.avgMem)} />
                                                <StatCard label='Max mem' value={formatBytes(r.maxMem)} />
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Usage;
