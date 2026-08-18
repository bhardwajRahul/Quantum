import { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, Cpu, MemoryStick, HardDrive, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { PageHeader, StatCard, EmptyState, LoadingBlock, Card, CardContent } from '@components/atoms/kit';
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from '@/components/ui/select';
import { metrics } from '@services/platform/service';
import { getRepositories } from '@services/repository/service';
import { formatBytes } from '@utilities/common/formatBytes';

const POLL_MS = 10000;

const asArray = (res) => Array.isArray(res) ? res : (res?.data || res?.repositories || []);

const pct = (n) => `${Math.max(0, Number(n) || 0).toFixed(1)}%`;

const Bars = ({ values, className }) => (
    <div className='flex items-end gap-[3px] h-20'>
        {values.length === 0 ? (
            <span className='text-xs text-muted-foreground'>No data</span>
        ) : values.map((v, i) => {
            const h = Math.max(2, Math.min(100, Number(v) || 0));
            return (
                <div
                    key={i}
                    title={`${(Number(v) || 0).toFixed(1)}%`}
                    className={`w-2 flex-none rounded-sm ${className}`}
                    style={{ height: `${h}%` }}
                />
            );
        })}
    </div>
);

const Metrics = () => {
    const [repositories, setRepositories] = useState([]);
    const [repoId, setRepoId] = useState('');
    const [series, setSeries] = useState([]);
    const [loadingRepos, setLoadingRepos] = useState(true);
    const [loadingMetrics, setLoadingMetrics] = useState(false);
    const [error, setError] = useState('');
    const intervalRef = useRef(null);

    useEffect(() => {
        let active = true;
        (async () => {
            try{
                const res = await getRepositories({});
                if(active) setRepositories(asArray(res));
            }catch(err){
                if(active) setError(typeof err === 'string' ? err : 'Failed to load repositories.');
            }finally{
                if(active) setLoadingRepos(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const fetchMetrics = useCallback(async (id, withSpinner) => {
        if(!id) return;
        if(withSpinner) setLoadingMetrics(true);
        try{
            const res = await metrics.byRepository({ query: { params: { repositoryId: id } } });
            setSeries(asArray(res));
            setError('');
        }catch(err){
            setError(typeof err === 'string' ? err : 'Failed to load metrics.');
        }finally{
            if(withSpinner) setLoadingMetrics(false);
        }
    }, []);

    useEffect(() => {
        if(intervalRef.current){
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setSeries([]);
        if(!repoId) return;
        fetchMetrics(repoId, true);
        intervalRef.current = setInterval(() => fetchMetrics(repoId, false), POLL_MS);
        return () => {
            if(intervalRef.current){
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [repoId, fetchMetrics]);

    const ordered = (() => {
        const arr = [...series];
        if(arr.length > 1 && arr[0]?.ts != null){
            arr.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
        }
        return arr;
    })();
    const latest = ordered[ordered.length - 1] || null;
    const recent = ordered.slice(-30);

    const tiles = latest ? [
        { label: 'CPU', value: pct(latest.cpuPercent), icon: Cpu },
        { label: 'Memory', value: pct(latest.memPercent), icon: MemoryStick },
        { label: 'Memory used', value: formatBytes(latest.memUsage), hint: latest.memLimit ? `of ${formatBytes(latest.memLimit)}` : undefined, icon: HardDrive },
        { label: 'Network RX', value: formatBytes(latest.netRx), icon: ArrowDownToLine },
        { label: 'Network TX', value: formatBytes(latest.netTx), icon: ArrowUpFromLine }
    ] : [];

    return (
        <div>
            <PageHeader
                title='Metrics'
                subtitle='Live CPU, memory and network usage per repository.'
            />

            {error && (
                <p className='mb-4 text-sm text-destructive'>{error}</p>
            )}

            <div className='flex items-end justify-between gap-4 flex-wrap mb-6'>
                <div className='max-w-sm flex-1 min-w-[240px] space-y-1.5'>
                    <label className='text-sm font-medium'>Repository</label>
                    <Select
                        value={repoId}
                        disabled={loadingRepos || repositories.length === 0}
                        onValueChange={(value) => setRepoId(value || '')}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder={loadingRepos ? 'Loading…' : 'Select a repository'} />
                        </SelectTrigger>
                        <SelectContent>
                            {repositories.map((r) => (
                                <SelectItem key={r._id} value={r._id}>{r.name || r.alias || r._id}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {repoId && (
                    <span className='text-xs text-muted-foreground'>
                        Auto-refreshing every 10s
                    </span>
                )}
            </div>

            {loadingRepos || (loadingMetrics && ordered.length === 0) ? (
                <LoadingBlock label='Loading metrics' />
            ) : !repoId ? (
                <EmptyState
                    icon={Activity}
                    title='Select a repository'
                    body='Choose one of your repositories above to view its live resource metrics.'
                />
            ) : !latest ? (
                <EmptyState
                    icon={Activity}
                    title='No samples yet'
                    body='Metrics appear once the app container is running.'
                />
            ) : (
                <div className='flex flex-col gap-8'>
                    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4'>
                        {tiles.map(({ label, value, hint, icon }) => (
                            <StatCard key={label} label={label} value={value} hint={hint} icon={icon} />
                        ))}
                    </div>

                    <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                        <Card>
                            <CardContent className='p-5'>
                                <h6 className='mb-4 text-sm font-semibold text-foreground'>
                                    CPU % over window
                                </h6>
                                <Bars values={recent.map((s) => s.cpuPercent)} className='bg-primary' />
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className='p-5'>
                                <h6 className='mb-4 text-sm font-semibold text-foreground'>
                                    Memory % over window
                                </h6>
                                <Bars values={recent.map((s) => s.memPercent)} className='bg-success' />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Metrics;
