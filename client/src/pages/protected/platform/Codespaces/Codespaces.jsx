import { useState, useEffect, useCallback } from 'react';
import { Plus, Code2, MoreVertical, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { codespaces } from '@services/platform/service';
import {
    PageHeader, StatusBadge, EmptyState, StatCard, DataTable, LoadingBlock
} from '@components/atoms/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import useTenancy from '@hooks/common/useTenancy';
import { formatAbsoluteDate } from '@utilities/common/dateUtils';

const CPU = { min: 1, max: 8, def: 2 };
const MEM = { min: 512, max: 16384, def: 2048 };
const DISK = { min: 1, max: 100, def: 20 };

const TRANSIENT = ['provisioning', 'pending'];
const isTransient = (status) => {
    const s = (status || '').toLowerCase();
    return TRANSIENT.some((x) => s.includes(x));
};

const formatResources = (cs) => {
    const cpu = cs.cpuCores ?? CPU.def;
    const mem = (cs.memoryMb ?? MEM.def) / 1024;
    const disk = cs.diskGb ?? DISK.def;
    const memLabel = Number.isInteger(mem) ? mem : mem.toFixed(1);
    return `${cpu} vCPU / ${memLabel} GB / ${disk} GB`;
};

const COLUMNS = [
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'resources', header: 'Resources' },
    { key: 'created', header: 'Created' }
];

const Codespaces = () => {
    const { projectId, hasProject } = useTenancy();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [items, setItems] = useState([]);

    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState('');
    const [cpuCores, setCpuCores] = useState(CPU.def);
    const [memoryMb, setMemoryMb] = useState(MEM.def);
    const [diskGb, setDiskGb] = useState(DISK.def);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState(null);

    const [accessOpen, setAccessOpen] = useState(false);
    const [accessLoading, setAccessLoading] = useState(false);
    const [accessData, setAccessData] = useState(null);
    const [accessError, setAccessError] = useState(null);

    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const load = useCallback(async ({ silent = false } = {}) => {
        if(!projectId) return;
        if(!silent) setLoading(true);
        if(!silent) setError(null);
        try{
            const res = await codespaces.listByProject({ query: { params: { projectId } } });
            setItems(res?.data || []);
        }catch(err){
            if(!silent) setError(typeof err === 'string' ? err : (err?.message || 'Failed to load codespaces.'));
        }finally{
            if(!silent) setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    const anyTransient = items.some((c) => isTransient(c.status));
    useEffect(() => {
        if(!projectId || !anyTransient) return undefined;
        const interval = setInterval(() => { load({ silent: true }); }, 5000);
        return () => clearInterval(interval);
    }, [projectId, anyTransient, load]);

    const clampNumber = (value, { min, max, def }) => {
        const n = Number(value);
        if(!Number.isFinite(n)) return def;
        return Math.min(max, Math.max(min, n));
    };

    const handleCreate = async () => {
        if(!name.trim()) return;
        setSubmitting(true);
        setFormError(null);
        try{
            await codespaces.createInProject({
                query: { params: { projectId } },
                body: {
                    name: name.trim(),
                    cpuCores: clampNumber(cpuCores, CPU),
                    memoryMb: clampNumber(memoryMb, MEM),
                    diskGb: clampNumber(diskGb, DISK)
                }
            });
            setCreateOpen(false);
            setName('');
            setCpuCores(CPU.def);
            setMemoryMb(MEM.def);
            setDiskGb(DISK.def);
            await load();
        }catch(err){
            setFormError(typeof err === 'string' ? err : (err?.message || 'Failed to create codespace.'));
        }finally{
            setSubmitting(false);
        }
    };

    const handleOpen = async (cs) => {
        setAccessOpen(true);
        setAccessLoading(true);
        setAccessError(null);
        setAccessData(null);
        try{
            const res = await codespaces.access({ query: { params: { id: cs._id } } });
            const data = res?.data || {};
            setAccessData(data);
            if(data.accessUrl){
                window.open(data.accessUrl, '_blank', 'noopener,noreferrer');
            }
        }catch(err){
            setAccessError(typeof err === 'string' ? err : (err?.message || 'Codespace is not ready yet.'));
        }finally{
            setAccessLoading(false);
        }
    };

    const handleDelete = async () => {
        if(!deleteTarget) return;
        setDeleting(true);
        try{
            await codespaces.remove({ query: { params: { id: deleteTarget._id } } });
            const removedName = deleteTarget.name;
            setDeleteTarget(null);
            toast.success(`Deleting "${removedName}"…`);
            await load({ silent: true });
        }catch(err){
            toast.error(typeof err === 'string' ? err : (err?.message || 'Delete failed.'));
        }finally{
            setDeleting(false);
        }
    };

    if(!hasProject){
        return (
            <div>
                <PageHeader
                    title='Codespaces'
                    subtitle='Spin up code-server dev environments.'
                />
                <EmptyState
                    icon={Code2}
                    title='Select or create a project to launch a codespace'
                    body='Codespaces are launched per project. Pick or create a project first.'
                />
            </div>
        );
    }

    const total = items.length;
    const running = items.filter((c) => (c.status || '').toLowerCase() === 'running').length;

    const rows = items.map((cs) => ({
        id: String(cs._id),
        name: cs.name,
        status: cs.status || 'unknown',
        resources: formatResources(cs),
        created: formatAbsoluteDate(cs.createdAt),
        _cs: cs
    }));

    const stats = [
        { label: 'Total codespaces', value: total },
        { label: 'Running', value: running, hint: total ? `${total - running} not running` : undefined }
    ];

    return (
        <div>
            <PageHeader
                title='Codespaces'
                subtitle='Spin up code-server dev environments.'
                actions={(
                    <Button onClick={() => { setFormError(null); setCreateOpen(true); }}>
                        <Plus className='h-4 w-4' /> New Codespace
                    </Button>
                )}
            />

            <Dialog open={createOpen} onOpenChange={(o) => !submitting && setCreateOpen(o)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New Codespace</DialogTitle>
                        <DialogDescription>Provisioning runs in the background.</DialogDescription>
                    </DialogHeader>
                    <div className='flex flex-col gap-4'>
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium'>Name</label>
                            <Input
                                placeholder='my-codespace'
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className='grid grid-cols-3 gap-3'>
                            <div className='space-y-1.5'>
                                <label className='text-sm font-medium'>vCPU</label>
                                <Input
                                    type='number'
                                    min={CPU.min}
                                    max={CPU.max}
                                    value={cpuCores}
                                    onChange={(e) => setCpuCores(e.target.value)}
                                />
                                <p className='text-xs text-muted-foreground'>{CPU.min}–{CPU.max}</p>
                            </div>
                            <div className='space-y-1.5'>
                                <label className='text-sm font-medium'>RAM (MB)</label>
                                <Input
                                    type='number'
                                    min={MEM.min}
                                    max={MEM.max}
                                    step={512}
                                    value={memoryMb}
                                    onChange={(e) => setMemoryMb(e.target.value)}
                                />
                                <p className='text-xs text-muted-foreground'>{MEM.min}–{MEM.max}</p>
                            </div>
                            <div className='space-y-1.5'>
                                <label className='text-sm font-medium'>Disk (GB)</label>
                                <Input
                                    type='number'
                                    min={DISK.min}
                                    max={DISK.max}
                                    value={diskGb}
                                    onChange={(e) => setDiskGb(e.target.value)}
                                />
                                <p className='text-xs text-muted-foreground'>{DISK.min}–{DISK.max}</p>
                            </div>
                        </div>
                        {formError && <p className='text-sm text-destructive'>{formError}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !submitting && setCreateOpen(false)}>
                            Cancel
                        </Button>
                        <Button disabled={submitting || !name.trim()} onClick={handleCreate}>
                            {submitting ? 'Creating…' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Codespace access</DialogTitle>
                        <DialogDescription>
                            We opened your codespace in a new tab. Use the password below to sign in.
                        </DialogDescription>
                    </DialogHeader>
                    {accessLoading ? (
                        <LoadingBlock label='Fetching access' />
                    ) : accessError ? (
                        <p className='text-sm text-destructive'>{accessError}</p>
                    ) : accessData ? (
                        <div className='flex flex-col gap-3'>
                            <div className='space-y-1.5'>
                                <label className='text-sm font-medium'>URL</label>
                                <Input value={accessData.accessUrl || ''} readOnly onFocus={(e) => e.target.select()} />
                            </div>
                            <div className='space-y-1.5'>
                                <label className='text-sm font-medium'>Password</label>
                                <Input value={accessData.password || ''} readOnly onFocus={(e) => e.target.select()} />
                            </div>
                        </div>
                    ) : null}
                    <DialogFooter>
                        {accessData?.accessUrl && (
                            <Button variant='outline' onClick={() => window.open(accessData.accessUrl, '_blank', 'noopener,noreferrer')}>
                                <ExternalLink className='h-4 w-4' /> Open
                            </Button>
                        )}
                        <Button onClick={() => setAccessOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deleteTarget} onOpenChange={(o) => !deleting && !o && setDeleteTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete codespace</DialogTitle>
                        <DialogDescription>
                            This permanently removes <strong>{deleteTarget?.name}</strong> and its workspace. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !deleting && setDeleteTarget(null)}>
                            Cancel
                        </Button>
                        <Button variant='destructive' disabled={deleting} onClick={handleDelete}>
                            {deleting ? 'Deleting…' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {loading ? (
                <LoadingBlock label='Loading codespaces' />
            ) : error ? (
                <p className='mb-4 text-sm text-destructive'>{error}</p>
            ) : total === 0 ? (
                <EmptyState
                    icon={Code2}
                    title='No codespaces yet'
                    body='Launch a code-server dev environment with configurable CPU, RAM and disk in seconds.'
                    action={(
                        <Button onClick={() => { setFormError(null); setCreateOpen(true); }}>
                            <Plus className='h-4 w-4' /> New Codespace
                        </Button>
                    )}
                />
            ) : (
                <div className='flex flex-col gap-8'>
                    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                        {stats.map(({ label, value, hint }) => (
                            <StatCard key={label} label={label} value={value} hint={hint} />
                        ))}
                    </div>

                    <DataTable
                        columns={COLUMNS}
                        rows={rows}
                        actions={(row) => {
                            const cs = row._cs;
                            const ready = (cs.status || '').toLowerCase() === 'running';
                            return (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant='ghost' size='icon'>
                                            <MoreVertical className='h-4 w-4' />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align='end'>
                                        <DropdownMenuItem disabled={!ready} onClick={() => handleOpen(cs)}>Open</DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className='text-destructive' onClick={() => setDeleteTarget(cs)}>Delete</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            );
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default Codespaces;
