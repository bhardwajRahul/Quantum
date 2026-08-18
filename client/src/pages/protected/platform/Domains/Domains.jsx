import { useState, useEffect, useCallback } from 'react';
import { Plus, Network, RefreshCw, MoreVertical } from 'lucide-react';
import {
    PageHeader, EmptyState, StatusBadge, Pill, CopyInline, DataTable, LoadingBlock, Button
} from '@components/atoms/kit';
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { domains } from '@services/platform/service';
import { getRepositories } from '@services/repository/service';

const asArray = (res) => Array.isArray(res) ? res : (res?.data || res?.repositories || []);

const Domains = () => {
    const [repositories, setRepositories] = useState([]);
    const [repoId, setRepoId] = useState('');
    const [domainList, setDomainList] = useState([]);
    const [loadingRepos, setLoadingRepos] = useState(true);
    const [loadingDomains, setLoadingDomains] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState(null);

    const [addOpen, setAddOpen] = useState(false);
    const [formRepoId, setFormRepoId] = useState('');
    const [host, setHost] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    const [pendingDelete, setPendingDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const [actioningId, setActioningId] = useState(null);

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

    const fetchDomains = useCallback(async (id) => {
        if(!id){
            setDomainList([]);
            return;
        }
        setLoadingDomains(true);
        setError('');
        try{
            const res = await domains.listByRepository({ query: { params: { repositoryId: id } } });
            setDomainList(asArray(res));
        }catch(err){
            setError(typeof err === 'string' ? err : 'Failed to load domains.');
            setDomainList([]);
        }finally{
            setLoadingDomains(false);
        }
    }, []);

    useEffect(() => { fetchDomains(repoId); }, [repoId, fetchDomains]);

    const handleCreate = async () => {
        const repositoryId = formRepoId || repoId;
        if(!repositoryId || !host.trim()){
            setFormError('Pick a repository and enter a host.');
            return;
        }
        setSubmitting(true);
        setFormError('');
        try{
            await domains.createForRepository({
                query: { params: { repositoryId } },
                body: { host: host.trim() }
            });
            setAddOpen(false);
            setHost('');
            if(repositoryId === repoId){
                fetchDomains(repoId);
            }else{
                setRepoId(repositoryId);
            }
        }catch(err){
            setFormError(typeof err === 'string' ? err : 'Failed to add domain.');
        }finally{
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if(!pendingDelete) return;
        setDeleting(true);
        try{
            await domains.remove({ query: { params: { id: pendingDelete._id } } });
            setPendingDelete(null);
            fetchDomains(repoId);
        }catch(err){
            setError(typeof err === 'string' ? err : 'Failed to remove domain.');
        }finally{
            setDeleting(false);
        }
    };

    const handleSetPrimary = async (domain) => {
        setActioningId(domain._id);
        setNotice(null);
        try{
            await domains.update({ query: { params: { id: domain._id } }, body: { isPrimary: true } });
            setNotice({ kind: 'success', text: `"${domain.host}" set as primary. Status may take a moment to reconcile.` });
            await fetchDomains(repoId);
        }catch(err){
            setNotice({ kind: 'error', text: typeof err === 'string' ? err : (err?.message || 'Failed to set primary domain.') });
        }finally{
            setActioningId(null);
        }
    };

    const handleToggleTls = async (domain) => {
        setActioningId(domain._id);
        setNotice(null);
        try{
            await domains.update({ query: { params: { id: domain._id } }, body: { tls: !domain.tls } });
            setNotice({ kind: 'success', text: `TLS ${domain.tls ? 'disabled' : 'enabled'} for "${domain.host}". Status may take a moment to reconcile.` });
            await fetchDomains(repoId);
        }catch(err){
            setNotice({ kind: 'error', text: typeof err === 'string' ? err : (err?.message || 'Failed to toggle TLS.') });
        }finally{
            setActioningId(null);
        }
    };

    const openAddDialog = () => {
        setFormRepoId(repoId || '');
        setHost('');
        setFormError('');
        setAddOpen(true);
    };

    const rows = domainList.map((d) => ({
        id: String(d._id),
        host: d.host,
        kind: d.kind || 'custom',
        status: d.status || 'pending',
        tls: d.tls ? 'Enabled' : 'Off',
        _domain: d
    }));

    const COLUMNS = [
        {
            key: 'host',
            header: 'Host',
            render: (row) => (
                <span className='inline-flex items-center gap-2'>
                    <CopyInline value={row.host} />
                    {row._domain?.isPrimary && <Pill tone='violet'>Primary</Pill>}
                </span>
            )
        },
        { key: 'kind', header: 'Kind' },
        { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
        { key: 'tls', header: 'TLS', render: (row) => <StatusBadge status={row.tls === 'Enabled' ? 'enabled' : 'disabled'} /> }
    ];

    return (
        <div>
            <PageHeader
                title='Domains'
                subtitle='Bind custom domains to a repository. TLS is provisioned automatically.'
                actions={(
                    <>
                        <Button
                            variant='outline'
                            disabled={!repoId || loadingDomains}
                            onClick={() => fetchDomains(repoId)}
                        >
                            <RefreshCw className='h-4 w-4' /> Refresh
                        </Button>
                        <Button
                            onClick={openAddDialog}
                            disabled={loadingRepos || repositories.length === 0}
                        >
                            <Plus className='h-4 w-4' /> Add Domain
                        </Button>
                    </>
                )}
            />

            {error && (
                <p className='mb-4 text-sm text-destructive'>{error}</p>
            )}

            {notice && (
                <p className={`mb-4 text-sm ${notice.kind === 'success' ? 'text-success' : 'text-destructive'}`}>
                    {notice.text}
                </p>
            )}

            <div className='max-w-sm mb-6 space-y-1.5'>
                <label className='text-sm font-medium'>Repository</label>
                <Select
                    value={repoId}
                    disabled={loadingRepos || repositories.length === 0}
                    onValueChange={(v) => setRepoId(v)}
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

            <Dialog open={addOpen} onOpenChange={(o) => !submitting && setAddOpen(o)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Domain</DialogTitle>
                        <DialogDescription>
                            Bind a custom domain to a repository. TLS is provisioned automatically.
                        </DialogDescription>
                    </DialogHeader>
                    <div className='flex flex-col gap-5'>
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium'>Repository</label>
                            <Select value={formRepoId} onValueChange={(v) => setFormRepoId(v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder='Select a repository' />
                                </SelectTrigger>
                                <SelectContent>
                                    {repositories.map((r) => (
                                        <SelectItem key={r._id} value={r._id}>{r.name || r.alias || r._id}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium'>Host</label>
                            <Input
                                placeholder='app.example.com'
                                value={host}
                                onChange={(e) => setHost(e.target.value)}
                            />
                        </div>
                        {formError && <p className='text-sm text-destructive'>{formError}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !submitting && setAddOpen(false)}>
                            Cancel
                        </Button>
                        <Button disabled={submitting} onClick={handleCreate}>
                            {submitting ? 'Adding…' : 'Add Domain'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!pendingDelete} onOpenChange={(o) => !deleting && !o && setPendingDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete domain</DialogTitle>
                        <DialogDescription>
                            Remove <strong>{pendingDelete?.host}</strong>? This stops routing traffic to it and releases its TLS certificate.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !deleting && setPendingDelete(null)}>
                            Cancel
                        </Button>
                        <Button variant='destructive' disabled={deleting} onClick={handleDelete}>
                            {deleting ? 'Deleting…' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {(loadingRepos || loadingDomains) ? (
                <LoadingBlock label='Loading domains' />
            ) : !repoId ? (
                <EmptyState
                    icon={Network}
                    title='Select a repository'
                    body='Choose one of your repositories above to view and manage its custom domains.'
                />
            ) : domainList.length === 0 ? (
                <EmptyState
                    icon={Network}
                    title='No domains yet'
                    body='This repository has no custom domains. Add one to route traffic and provision TLS.'
                    action={(
                        <Button onClick={openAddDialog}>
                            <Plus className='h-4 w-4' /> Add Domain
                        </Button>
                    )}
                />
            ) : (
                <div className='flex flex-col gap-3'>
                    <DataTable
                        columns={COLUMNS}
                        rows={rows}
                        actions={(row) => {
                            const domain = row._domain;
                            return (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant='ghost' size='icon' disabled={actioningId === domain?._id}>
                                            <MoreVertical className='h-4 w-4' />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align='end'>
                                        <DropdownMenuItem
                                            disabled={domain?.isPrimary}
                                            onClick={() => handleSetPrimary(domain)}
                                        >
                                            Set as primary
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleToggleTls(domain)}>
                                            {domain?.tls ? 'Disable TLS' : 'Enable TLS'}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => fetchDomains(repoId)}>
                                            Re-check
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className='text-destructive' onClick={() => setPendingDelete(domain)}>
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            );
                        }}
                    />
                    <p className='text-xs text-muted-foreground'>
                        Status and TLS changes reconcile asynchronously — use Refresh or Re-check after a moment to see the latest state.
                    </p>
                </div>
            )}
        </div>
    );
};

export default Domains;
