import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, FolderKanban } from 'lucide-react';
import { PageHeader, Pill, EmptyState, LoadingBlock, RowActionsMenu, ConfirmDialog } from '@components/atoms/kit';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { organizations, projects } from '@services/platform/service';
import { useAsyncAction } from '@hooks/common';
import { errText } from '@utilities/common/errText';
import { unwrapList } from '@utilities/api/unwrap';
import EnvironmentsModal from './EnvironmentsModal';

const Projects = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [groups, setGroups] = useState([]);

    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [orgId, setOrgId] = useState('');

    const [orgOpen, setOrgOpen] = useState(false);
    const [orgName, setOrgName] = useState('');

    const [renameTarget, setRenameTarget] = useState(null);
    const [renameValue, setRenameValue] = useState('');

    const [deleteTarget, setDeleteTarget] = useState(null);

    const [envTarget, setEnvTarget] = useState(null);

    const createProject = useAsyncAction({ fallback: 'Failed to create project.' });
    const createOrg = useAsyncAction({ fallback: 'Failed to create organization.' });
    const renameProject = useAsyncAction({ fallback: 'Failed to rename project.' });
    const deleteProject = useAsyncAction({ onError: setError, fallback: 'Failed to delete project.' });

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try{
            const orgRes = await organizations.list({});
            const orgs = unwrapList(orgRes);
            const withProjects = await Promise.all(orgs.map(async (org) => {
                try{
                    const res = await projects.listByOrg({ query: { params: { orgId: org._id } } });
                    return { org, projects: unwrapList(res) };
                }catch{
                    return { org, projects: [] };
                }
            }));
            setGroups(withProjects);
            if(orgs.length) setOrgId((prev) => prev || orgs[0]._id);
        }catch(err){
            setError(errText(err, 'Failed to load projects.'));
        }finally{
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async () => {
        if(!name.trim() || !orgId) return;
        const ok = await createProject.run(() => projects.createInOrg({
            query: { params: { orgId } },
            body: { name: name.trim() }
        }));
        if(ok){
            setOpen(false);
            setName('');
            await load();
        }
    };

    const handleCreateOrg = async () => {
        if(!orgName.trim()) return;
        const ok = await createOrg.run(() => organizations.create({ body: { name: orgName.trim() } }));
        if(ok){
            setOrgOpen(false);
            setOrgName('');
            await load();
        }
    };

    const openRename = (project) => {
        setRenameTarget(project);
        setRenameValue(project.name || '');
        renameProject.clearError();
    };

    const handleRename = async () => {
        if(!renameTarget || !renameValue.trim()) return;
        const ok = await renameProject.run(() => projects.update({
            query: { params: { id: renameTarget._id } },
            body: { name: renameValue.trim() }
        }));
        if(ok){
            setRenameTarget(null);
            await load();
        }
    };

    const handleDelete = async () => {
        if(!deleteTarget) return;
        const ok = await deleteProject.run(() => projects.remove({
            query: { params: { id: deleteTarget._id } }
        }));
        if(ok){
            setDeleteTarget(null);
            await load();
        }
    };

    const orgs = useMemo(() => groups.map((g) => g.org), [groups]);
    const hasProjects = useMemo(() => groups.some((g) => g.projects.length > 0), [groups]);

    return (
        <div>
            <PageHeader
                title='Projects'
                subtitle='Group related deployments by organization.'
                actions={(
                    <Button
                        onClick={() => { createProject.clearError(); setOpen(true); }}
                        disabled={orgs.length === 0}
                    >
                        <Plus className='h-4 w-4' /> New Project
                    </Button>
                )}
            />

            <Dialog open={open} onOpenChange={(o) => !createProject.pending && setOpen(o)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New Project</DialogTitle>
                        <DialogDescription>Create a project to group related deployments.</DialogDescription>
                    </DialogHeader>
                    <div className='flex flex-col gap-5'>
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium'>Name</label>
                            <Input
                                placeholder='my-awesome-project'
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium'>Organization</label>
                            <Select value={orgId} onValueChange={setOrgId}>
                                <SelectTrigger><SelectValue placeholder='Organization' /></SelectTrigger>
                                <SelectContent>
                                    {orgs.map((org) => (
                                        <SelectItem key={org._id} value={org._id}>{org.name || org.slug || org._id}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {createProject.error && <p className='text-sm text-destructive'>{createProject.error}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !createProject.pending && setOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreate} disabled={createProject.pending || !name.trim() || !orgId}>
                            {createProject.pending ? 'Creating…' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={orgOpen} onOpenChange={(o) => !createOrg.pending && setOrgOpen(o)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create organization</DialogTitle>
                        <DialogDescription>Organizations are the top-level container for your projects.</DialogDescription>
                    </DialogHeader>
                    <div className='flex flex-col gap-5'>
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium'>Name</label>
                            <Input
                                placeholder='my-organization'
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                            />
                        </div>
                        {createOrg.error && <p className='text-sm text-destructive'>{createOrg.error}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !createOrg.pending && setOrgOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateOrg} disabled={createOrg.pending || !orgName.trim()}>
                            {createOrg.pending ? 'Creating…' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!renameTarget} onOpenChange={(o) => !renameProject.pending && !o && setRenameTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename project</DialogTitle>
                    </DialogHeader>
                    <div className='flex flex-col gap-5'>
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium'>Name</label>
                            <Input
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                            />
                        </div>
                        {renameProject.error && <p className='text-sm text-destructive'>{renameProject.error}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !renameProject.pending && setRenameTarget(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleRename} disabled={renameProject.pending || !renameValue.trim()}>
                            {renameProject.pending ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={!!deleteTarget}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title='Delete project'
                description={deleteTarget ? `This permanently removes "${deleteTarget.name}" and its environments. This action cannot be undone.` : ''}
                pending={deleteProject.pending}
                destructive
                confirmLabel='Delete'
                pendingLabel='Deleting…'
            />

            {envTarget && (
                <EnvironmentsModal project={envTarget} onClose={() => setEnvTarget(null)} />
            )}

            {loading ? (
                <LoadingBlock label='Loading projects' />
            ) : error ? (
                <p className='mb-4 text-sm text-destructive'>{error}</p>
            ) : !hasProjects ? (
                <EmptyState
                    icon={FolderKanban}
                    title='No projects yet'
                    body={orgs.length === 0
                        ? 'Create an organization first to start grouping deployments.'
                        : 'Projects group related deployments. Create your first one to get started.'}
                    action={orgs.length === 0
                        ? (
                            <Button onClick={() => { createOrg.clearError(); setOrgOpen(true); }}>
                                <Plus className='h-4 w-4' /> Create organization
                            </Button>
                        )
                        : (
                            <Button onClick={() => { createProject.clearError(); setOpen(true); }}>
                                <Plus className='h-4 w-4' /> New Project
                            </Button>
                        )}
                />
            ) : (
                <div className='flex flex-col gap-10'>
                    {groups.map(({ org, projects: list }) => (
                        <div key={org._id}>
                            <h2 className='text-lg font-semibold text-foreground mb-3'>
                                {org.name || org.slug || 'Organization'}
                            </h2>
                            {list.length === 0 ? (
                                <p className='text-sm text-muted-foreground'>
                                    No projects in this organization.
                                </p>
                            ) : (
                                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                                    {list.map((project) => (
                                        <Card key={project._id}>
                                            <CardContent className='p-5 flex flex-col h-full'>
                                                <div className='flex items-start justify-between gap-2'>
                                                    <div className='min-w-0'>
                                                        <h3 className='text-base font-semibold text-foreground truncate'>
                                                            {project.name}
                                                        </h3>
                                                        <p className='mt-1 text-xs text-muted-foreground truncate'>
                                                            {project.slug || project._id}
                                                        </p>
                                                    </div>
                                                    <RowActionsMenu items={[
                                                        { label: 'Rename', onClick: () => openRename(project) },
                                                        { label: 'Manage environments', onClick: () => setEnvTarget(project) },
                                                        { label: 'Delete', danger: true, separatorBefore: true, onClick: () => setDeleteTarget(project) }
                                                    ]} />
                                                </div>
                                                <div className='flex items-center justify-between gap-2 mt-4'>
                                                    <Pill tone='gray'>{`${project.environments?.length || 0} env`}</Pill>
                                                    <Button
                                                        variant='link'
                                                        onClick={() => setEnvTarget(project)}
                                                        className='h-auto p-0'
                                                    >
                                                        Manage environments
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Projects;
