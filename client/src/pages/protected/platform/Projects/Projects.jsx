/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
****/

import { useState, useEffect, useCallback } from 'react';
import { Plus, FolderKanban, MoreVertical } from 'lucide-react';
import { PageHeader, Pill, EmptyState, LoadingBlock } from '@components/atoms/kit';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { organizations, projects, environments } from '@services/platform/service';
import EnvironmentsModal from './EnvironmentsModal';

/**
 * Projects browser. Loads the caller's organizations, then the projects under
 * each one, and renders them grouped by org. A "New Project" dialog creates a
 * project inside a chosen org and refetches. Per-project actions (rename,
 * delete) live in a menu on each card; environments are managed in a
 * self-contained dialog. Local state only; calls the service layer with try/catch.
 */
const Projects = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // [{ org, projects: [...] }]
    const [groups, setGroups] = useState([]);

    // New-project modal state.
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [orgId, setOrgId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState(null);

    // Create-organization modal state.
    const [orgOpen, setOrgOpen] = useState(false);
    const [orgName, setOrgName] = useState('');
    const [orgSubmitting, setOrgSubmitting] = useState(false);
    const [orgFormError, setOrgFormError] = useState(null);

    // Rename-project modal state.
    const [renameTarget, setRenameTarget] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [renaming, setRenaming] = useState(false);
    const [renameError, setRenameError] = useState(null);

    // Delete-project confirm state.
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // Environments modal target (the project whose envs we're managing).
    const [envTarget, setEnvTarget] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try{
            const orgRes = await organizations.list({});
            const orgs = orgRes?.data || [];
            const withProjects = await Promise.all(orgs.map(async (org) => {
                try{
                    const res = await projects.listByOrg({ query: { params: { orgId: org._id } } });
                    return { org, projects: res?.data || [] };
                }catch{
                    return { org, projects: [] };
                }
            }));
            setGroups(withProjects);
            if(orgs.length) setOrgId((prev) => prev || orgs[0]._id);
        }catch(err){
            setError(typeof err === 'string' ? err : (err?.message || 'Failed to load projects.'));
        }finally{
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async () => {
        if(!name.trim() || !orgId) return;
        setSubmitting(true);
        setFormError(null);
        try{
            await projects.createInOrg({ query: { params: { orgId } }, body: { name: name.trim() } });
            setOpen(false);
            setName('');
            await load();
        }catch(err){
            setFormError(typeof err === 'string' ? err : (err?.message || 'Failed to create project.'));
        }finally{
            setSubmitting(false);
        }
    };

    const handleCreateOrg = async () => {
        if(!orgName.trim()) return;
        setOrgSubmitting(true);
        setOrgFormError(null);
        try{
            await organizations.create({ body: { name: orgName.trim() } });
            setOrgOpen(false);
            setOrgName('');
            await load();
        }catch(err){
            setOrgFormError(typeof err === 'string' ? err : (err?.message || 'Failed to create organization.'));
        }finally{
            setOrgSubmitting(false);
        }
    };

    const openRename = (project) => {
        setRenameTarget(project);
        setRenameValue(project.name || '');
        setRenameError(null);
    };

    const handleRename = async () => {
        if(!renameTarget || !renameValue.trim()) return;
        setRenaming(true);
        setRenameError(null);
        try{
            await projects.update({ query: { params: { id: renameTarget._id } }, body: { name: renameValue.trim() } });
            setRenameTarget(null);
            await load();
        }catch(err){
            setRenameError(typeof err === 'string' ? err : (err?.message || 'Failed to rename project.'));
        }finally{
            setRenaming(false);
        }
    };

    const handleDelete = async () => {
        if(!deleteTarget) return;
        setDeleting(true);
        try{
            await projects.remove({ query: { params: { id: deleteTarget._id } } });
            setDeleteTarget(null);
            await load();
        }catch(err){
            setError(typeof err === 'string' ? err : (err?.message || 'Failed to delete project.'));
        }finally{
            setDeleting(false);
        }
    };

    const orgs = groups.map((g) => g.org);
    const totalProjects = groups.reduce((acc, g) => acc + g.projects.length, 0);
    const hasProjects = totalProjects > 0;

    return (
        <div>
            <PageHeader
                title='Projects'
                subtitle='Group related deployments by organization.'
                actions={(
                    <Button
                        onClick={() => { setFormError(null); setOpen(true); }}
                        disabled={orgs.length === 0}
                    >
                        <Plus className='h-4 w-4' /> New Project
                    </Button>
                )}
            />

            {/* New-project dialog. */}
            <Dialog open={open} onOpenChange={(o) => !submitting && setOpen(o)}>
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
                        {formError && <p className='text-sm text-destructive'>{formError}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !submitting && setOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreate} disabled={submitting || !name.trim() || !orgId}>
                            {submitting ? 'Creating…' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create-organization dialog. */}
            <Dialog open={orgOpen} onOpenChange={(o) => !orgSubmitting && setOrgOpen(o)}>
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
                        {orgFormError && <p className='text-sm text-destructive'>{orgFormError}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !orgSubmitting && setOrgOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateOrg} disabled={orgSubmitting || !orgName.trim()}>
                            {orgSubmitting ? 'Creating…' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rename-project dialog. */}
            <Dialog open={!!renameTarget} onOpenChange={(o) => !renaming && !o && setRenameTarget(null)}>
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
                        {renameError && <p className='text-sm text-destructive'>{renameError}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !renaming && setRenameTarget(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleRename} disabled={renaming || !renameValue.trim()}>
                            {renaming ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete-project confirm dialog. */}
            <Dialog open={!!deleteTarget} onOpenChange={(o) => !deleting && !o && setDeleteTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete project</DialogTitle>
                        <DialogDescription>
                            This permanently removes <strong>{deleteTarget?.name}</strong> and its environments. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !deleting && setDeleteTarget(null)}>
                            Cancel
                        </Button>
                        <Button variant='destructive' onClick={handleDelete} disabled={deleting}>
                            {deleting ? 'Deleting…' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Environments manager dialog. */}
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
                            <Button onClick={() => { setOrgFormError(null); setOrgOpen(true); }}>
                                <Plus className='h-4 w-4' /> Create organization
                            </Button>
                        )
                        : (
                            <Button onClick={() => { setFormError(null); setOpen(true); }}>
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
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant='ghost' size='icon'>
                                                                <MoreVertical className='h-4 w-4' />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align='end'>
                                                            <DropdownMenuItem onClick={() => openRename(project)}>Rename</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => setEnvTarget(project)}>Manage environments</DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className='text-destructive' onClick={() => setDeleteTarget(project)}>Delete</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
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
