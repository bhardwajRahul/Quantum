import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Boxes, MoreVertical, Search, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import {
    PageHeader, StatusBadge, Pill, EmptyState, DataTable, LoadingBlock, Button, CopyInline
} from '@components/atoms/kit';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from '@/components/ui/select';
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { getRepositories, deleteRepository } from '@services/repository/service';
import { databases, templateInstalls } from '@services/platform/service';
import useTenancy from '@hooks/common/useTenancy';
import { formatAbsoluteDate, formatAbsoluteDateTime } from '@utilities/common/dateUtils';
import { errText } from '@utilities/common/errText';

const ENGINES = [
    { value: 'postgres', label: 'PostgreSQL' },
    { value: 'mysql', label: 'MySQL' },
    { value: 'mariadb', label: 'MariaDB' },
    { value: 'mongodb', label: 'MongoDB' },
    { value: 'redis', label: 'Redis' }
];

const TRANSIENT = ['provisioning', 'pending', 'creating', 'queued', 'restoring', 'backing-up'];
const isTransient = (status) => {
    const s = (status || '').toLowerCase();
    return TRANSIENT.some((x) => s.includes(x));
};

const formatBytes = (bytes) => {
    const n = Number(bytes);
    if(bytes == null || Number.isNaN(n)) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = n;
    let i = 0;
    while(value >= 1024 && i < units.length - 1){ value /= 1024; i++; }
    return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`;
};

const Applications = () => {
    const navigate = useNavigate();
    const { projectId, hasProject } = useTenancy();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [repos, setRepos] = useState([]);
    const [dbs, setDbs] = useState([]);
    const [installs, setInstalls] = useState([]);
    const [search, setSearch] = useState('');

    const [deleteApp, setDeleteApp] = useState(null);
    const [deletingApp, setDeletingApp] = useState(false);

    const [uninstallTarget, setUninstallTarget] = useState(null);
    const [uninstalling, setUninstalling] = useState(false);

    const [createOpen, setCreateOpen] = useState(false);
    const [dbName, setDbName] = useState('');
    const [engine, setEngine] = useState('postgres');
    const [version, setVersion] = useState('');
    const [creatingDb, setCreatingDb] = useState(false);
    const [createError, setCreateError] = useState(null);

    const [connOpen, setConnOpen] = useState(false);
    const [connLoading, setConnLoading] = useState(false);
    const [connValue, setConnValue] = useState('');
    const [connError, setConnError] = useState(null);
    const [connRevealed, setConnRevealed] = useState(false);

    const [restoreTarget, setRestoreTarget] = useState(null);
    const [restoreBackupId, setRestoreBackupId] = useState('');
    const [restoring, setRestoring] = useState(false);

    const [deleteDb, setDeleteDb] = useState(null);
    const [deletingDb, setDeletingDb] = useState(false);

    const load = useCallback(async ({ silent = false } = {}) => {
        if(!silent) setLoading(true);
        if(!silent) setError(null);
        try{
            const [repoRes, dbRes, installRes] = await Promise.all([
                getRepositories({}),
                projectId
                    ? databases.listByProject({ query: { params: { projectId } } })
                    : Promise.resolve(null),
                projectId
                    ? templateInstalls.listByProject({ query: { params: { projectId } } })
                    : Promise.resolve(null)
            ]);
            setRepos(repoRes?.data || repoRes?.repositories || []);
            setDbs(dbRes?.data || []);
            setInstalls(installRes?.data || []);
        }catch(err){
            if(!silent) setError(errText(err, 'Failed to load applications.'));
        }finally{
            if(!silent) setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    const anyTransient = [...dbs, ...installs].some((d) => isTransient(d.status));
    useEffect(() => {
        if(!anyTransient) return undefined;
        const interval = setInterval(() => { load({ silent: true }); }, 5000);
        return () => clearInterval(interval);
    }, [anyTransient, load]);

    const goDeployments = (alias) => navigate('/repository/' + encodeURIComponent(alias) + '/deployments/');
    const goShell = (alias) => navigate('/repository/' + encodeURIComponent(alias) + '/shell');
    const goEnvVars = (alias) => navigate('/repository/' + encodeURIComponent(alias) + '/deployment/environment-variables');

    const handleDeleteApp = async () => {
        if(!deleteApp) return;
        setDeletingApp(true);
        try{
            await deleteRepository({ query: { params: { id: deleteApp._id } } });
            setRepos((prev) => prev.filter((r) => r._id !== deleteApp._id));
            toast.success(`Deleted "${deleteApp.name}".`);
            setDeleteApp(null);
        }catch(err){
            toast.error(errText(err, 'Delete failed.'));
        }finally{
            setDeletingApp(false);
        }
    };

    const handleCreateDb = async () => {
        if(!dbName.trim() || !projectId) return;
        setCreatingDb(true);
        setCreateError(null);
        try{
            await databases.createInProject({
                query: { params: { projectId } },
                body: {
                    name: dbName.trim(),
                    engine,
                    ...(version.trim() ? { version: version.trim() } : {})
                }
            });
            setCreateOpen(false);
            setDbName('');
            setVersion('');
            setEngine('postgres');
            await load();
        }catch(err){
            setCreateError(errText(err, 'Failed to create database.'));
        }finally{
            setCreatingDb(false);
        }
    };

    const openConnectionString = async (db) => {
        setConnOpen(true);
        setConnLoading(true);
        setConnError(null);
        setConnValue('');
        setConnRevealed(false);
        try{
            const res = await databases.connectionString({ query: { params: { id: db._id } } });
            const value = res?.data?.connectionString || res?.data?.uri || res?.data
                || res?.connectionString || '';
            setConnValue(typeof value === 'string' ? value : JSON.stringify(value));
        }catch(err){
            setConnError(errText(err, 'Failed to fetch connection string.'));
        }finally{
            setConnLoading(false);
        }
    };

    const handleBackup = async (db) => {
        try{
            await databases.backup({ query: { params: { id: db._id } } });
            toast.success(`Backup started for "${db.name}".`);
            await load({ silent: true });
        }catch(err){
            toast.error(errText(err, 'Backup failed.'));
        }
    };

    const openRestore = (db) => {
        setRestoreTarget(db);
        setRestoreBackupId(db?.backups?.[0]?.id || '');
    };

    const handleRestore = async () => {
        if(!restoreTarget || !restoreBackupId) return;
        setRestoring(true);
        try{
            await databases.restore({ query: { params: { id: restoreTarget._id } }, body: { backupId: restoreBackupId } });
            toast.success(`Restore started for "${restoreTarget.name}".`);
            setRestoreTarget(null);
            setRestoreBackupId('');
            await load();
        }catch(err){
            toast.error(errText(err, 'Restore failed.'));
        }finally{
            setRestoring(false);
        }
    };

    const handleDeleteDb = async () => {
        if(!deleteDb) return;
        setDeletingDb(true);
        try{
            await databases.remove({ query: { params: { id: deleteDb._id } } });
            toast.success(`Deleted "${deleteDb.name}".`);
            setDeleteDb(null);
            await load();
        }catch(err){
            toast.error(errText(err, 'Delete failed.'));
        }finally{
            setDeletingDb(false);
        }
    };

    const handleUninstall = async () => {
        if(!uninstallTarget) return;
        setUninstalling(true);
        try{
            await templateInstalls.remove({ query: { params: { id: uninstallTarget._id || uninstallTarget.id } } });
            toast.success(`Removed "${uninstallTarget.name}".`);
            setUninstallTarget(null);
            await load();
        }catch(err){
            toast.error(errText(err, 'Uninstall failed.'));
        }finally{
            setUninstalling(false);
        }
    };

    const rows = useMemo(() => {
        const appRows = repos.map((repo, idx) => {
            const alias = repo.alias || repo.name || '';
            return {
                id: String(repo._id || repo.id || alias || `app-${idx}`),
                kind: 'app',
                name: alias || repo.name || '—',
                detail: repo.url || '',
                type: 'Application',
                status: repo.activeDeployment?.status || repo.status || 'unknown',
                created: formatAbsoluteDate(repo.createdAt),
                _alias: alias,
                _entity: repo
            };
        });
        const dbRows = dbs.map((db, idx) => ({
            id: String(db._id || `db-${idx}`),
            kind: 'database',
            name: db.name || '—',
            detail: `${db.engine || 'unknown'}${db.version ? ' ' + db.version : ''}`,
            type: db.engine ? db.engine.charAt(0).toUpperCase() + db.engine.slice(1) : 'Database',
            status: db.status || 'unknown',
            created: formatAbsoluteDate(db.createdAt),
            _entity: db
        }));
        const installRows = installs.map((install, idx) => {
            const tplName = install.templateName || install.template?.name;
            return {
                id: String(install._id || install.id || `install-${idx}`),
                kind: 'install',
                name: install.name || '—',
                detail: tplName ? `Template · ${tplName}` : 'Template',
                type: tplName || 'Template',
                status: install.status || 'unknown',
                created: formatAbsoluteDate(install.createdAt),
                _entity: install
            };
        });
        return [...appRows, ...dbRows, ...installRows];
    }, [repos, dbs, installs]);

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        if(!q) return rows;
        return rows.filter((r) => (
            [r.name, r.detail, r.status, r.type].some((v) => String(v).toLowerCase().includes(q))
        ));
    }, [rows, search]);

    const columns = [
        {
            key: 'name',
            header: 'Name',
            render: (row) => (
                <div className='flex items-center gap-3'>
                    <Avatar>
                        <AvatarFallback className='bg-primary/10 text-primary text-xs font-semibold uppercase'>
                            {String(row.name || '?').slice(0, 2)}
                        </AvatarFallback>
                    </Avatar>
                    <div className='min-w-0'>
                        <p className='font-medium text-foreground truncate'>{row.name}</p>
                        <p className='font-mono text-xs text-muted-foreground truncate'>{row.detail || '—'}</p>
                    </div>
                </div>
            )
        },
        {
            key: 'type',
            header: 'Type',
            render: (row) => {
                const tone = row.kind === 'database' ? 'violet' : row.kind === 'install' ? 'gray' : 'green';
                return <Pill tone={tone}>{row.type}</Pill>;
            }
        },
        { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
        { key: 'created', header: 'Created' }
    ];

    const rowActions = (row) => {
        if(row.kind === 'install'){
            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant='ghost' size='icon'><MoreVertical className='h-4 w-4' /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end'>
                        <DropdownMenuItem className='text-destructive' onClick={() => setUninstallTarget(row._entity)}>Uninstall</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        }
        if(row.kind === 'database'){
            const db = row._entity;
            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant='ghost' size='icon'><MoreVertical className='h-4 w-4' /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end'>
                        <DropdownMenuItem onClick={() => openConnectionString(db)}>Connection string</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBackup(db)}>Backup</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openRestore(db)}>Restore</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className='text-destructive' onClick={() => setDeleteDb(db)}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        }
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='icon'><MoreVertical className='h-4 w-4' /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                    <DropdownMenuItem onClick={() => goDeployments(row._alias)}>Deployments</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => goShell(row._alias)}>Shell</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => goEnvVars(row._alias)}>Environment variables</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className='text-destructive' onClick={() => setDeleteApp(row._entity)}>Delete</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    };

    const headerActions = (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button><Plus className='h-4 w-4' /> New</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
                <DropdownMenuItem onClick={() => navigate('/repository/create')}>Application</DropdownMenuItem>
                <DropdownMenuItem
                    disabled={!hasProject}
                    onClick={() => { if(hasProject){ setCreateError(null); setCreateOpen(true); } }}
                >
                    Database{!hasProject ? ' (select a project)' : ''}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    return (
        <div>
            <PageHeader
                title='Applications'
                subtitle='Your deployed applications, services and databases.'
                actions={headerActions}
            />

            {loading ? (
                <LoadingBlock label='Loading applications' />
            ) : error ? (
                <p className='mb-4 text-sm text-destructive'>{error}</p>
            ) : rows.length === 0 ? (
                <EmptyState
                    icon={Boxes}
                    title='Deploy your first app'
                    body='Connect a repository or provision a database and Quantum will build, deploy, and run it for you. Everything you deploy shows up here.'
                    action={headerActions}
                />
            ) : (
                <div className='flex flex-col gap-4'>
                    <div className='w-full max-w-xs'>
                        <div className='relative'>
                            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder='Search applications'
                                className='pl-9'
                            />
                        </div>
                    </div>
                    <DataTable
                        columns={columns}
                        rows={filteredRows}
                        onRowClick={(row) => {
                            if(row.kind === 'app' && row._alias) goDeployments(row._alias);
                            else if(row.kind === 'database') openConnectionString(row._entity);
                        }}
                        actions={rowActions}
                    />
                </div>
            )}

            <Dialog open={!!deleteApp} onOpenChange={(o) => !deletingApp && !o && setDeleteApp(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete application</DialogTitle>
                        <DialogDescription>
                            This permanently removes <strong>{deleteApp?.alias || deleteApp?.name}</strong>, its container, deployments and webhook. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !deletingApp && setDeleteApp(null)}>Cancel</Button>
                        <Button variant='destructive' disabled={deletingApp} onClick={handleDeleteApp}>
                            {deletingApp ? 'Deleting…' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={createOpen} onOpenChange={(o) => !creatingDb && setCreateOpen(o)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New Database</DialogTitle>
                        <DialogDescription>Provisioning runs in the background.</DialogDescription>
                    </DialogHeader>
                    <div className='flex flex-col gap-4'>
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium'>Name</label>
                            <Input placeholder='my-database' value={dbName} onChange={(e) => setDbName(e.target.value)} />
                        </div>
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium'>Engine</label>
                            <Select value={engine} onValueChange={setEngine}>
                                <SelectTrigger><SelectValue placeholder='Engine' /></SelectTrigger>
                                <SelectContent>
                                    {ENGINES.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium'>Version (optional)</label>
                            <Input placeholder='latest' value={version} onChange={(e) => setVersion(e.target.value)} />
                        </div>
                        {createError && <p className='text-sm text-destructive'>{createError}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !creatingDb && setCreateOpen(false)}>Cancel</Button>
                        <Button disabled={creatingDb || !dbName.trim()} onClick={handleCreateDb}>
                            {creatingDb ? 'Creating…' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={connOpen} onOpenChange={setConnOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Connection string</DialogTitle>
                        <DialogDescription>
                            Treat this as a secret. Anyone with it can connect to your database.
                        </DialogDescription>
                    </DialogHeader>
                    {connLoading ? (
                        <LoadingBlock label='Loading connection string' />
                    ) : connError ? (
                        <p className='text-sm text-destructive'>{connError}</p>
                    ) : (
                        <div className='flex flex-col gap-2'>
                            <div className='relative'>
                                <Input
                                    type={connRevealed ? 'text' : 'password'}
                                    value={connValue}
                                    readOnly
                                    onFocus={(e) => e.target.select()}
                                    className='pr-10'
                                />
                                <button
                                    type='button'
                                    onClick={() => setConnRevealed((v) => !v)}
                                    className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary'
                                    aria-label={connRevealed ? 'Hide' : 'Show'}
                                >
                                    {connRevealed ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                                </button>
                            </div>
                            <div className='px-1'><CopyInline value={connValue} /></div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant='outline' onClick={() => setConnOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!restoreTarget} onOpenChange={(o) => !restoring && !o && setRestoreTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Restore database</DialogTitle>
                        {restoreTarget?.backups?.length ? (
                            <DialogDescription>
                                Restoring overwrites the current data in <strong>{restoreTarget?.name}</strong> with
                                the selected backup. This cannot be undone.
                            </DialogDescription>
                        ) : (
                            <DialogDescription>No backups yet.</DialogDescription>
                        )}
                    </DialogHeader>
                    {restoreTarget?.backups?.length ? (
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium'>Backup</label>
                            <Select value={restoreBackupId} onValueChange={setRestoreBackupId}>
                                <SelectTrigger><SelectValue placeholder='Select a backup' /></SelectTrigger>
                                <SelectContent>
                                    {restoreTarget.backups.map((b) => (
                                        <SelectItem key={b.id} value={b.id}>
                                            {`${formatAbsoluteDateTime(b.createdAt)} · ${formatBytes(b.sizeBytes)}`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : null}
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !restoring && setRestoreTarget(null)}>Cancel</Button>
                        <Button
                            disabled={restoring || !restoreBackupId || !(restoreTarget?.backups?.length)}
                            onClick={handleRestore}
                        >
                            {restoring ? 'Restoring…' : 'Restore'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deleteDb} onOpenChange={(o) => !deletingDb && !o && setDeleteDb(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete database</DialogTitle>
                        <DialogDescription>
                            This permanently removes <strong>{deleteDb?.name}</strong> and its data. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !deletingDb && setDeleteDb(null)}>Cancel</Button>
                        <Button variant='destructive' disabled={deletingDb} onClick={handleDeleteDb}>
                            {deletingDb ? 'Deleting…' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!uninstallTarget} onOpenChange={(o) => !uninstalling && !o && setUninstallTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Uninstall</DialogTitle>
                        <DialogDescription>
                            This removes <strong>{uninstallTarget?.name}</strong> and its provisioned resources. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !uninstalling && setUninstallTarget(null)}>Cancel</Button>
                        <Button variant='destructive' disabled={uninstalling} onClick={handleUninstall}>
                            {uninstalling ? 'Uninstalling…' : 'Uninstall'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Applications;
