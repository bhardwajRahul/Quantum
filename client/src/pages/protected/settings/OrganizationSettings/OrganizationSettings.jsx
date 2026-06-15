/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
****/

import { useState, useEffect } from 'react';
import { Settings, Plus, Trash2 } from 'lucide-react';
import { PageHeader, EmptyState, Button } from '@components/atoms/kit';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { organizations } from '@services/platform/service';
import useTenancy from '@hooks/common/useTenancy';
import { errText } from '@utilities/common/errText';

/**
 * Organization settings (org-scoped). Lets the user rename the selected org,
 * see its read-only slug, create a new organization, and delete the current
 * one. organizations.update/remove are addressed by the org id from tenancy;
 * after a delete we hard-navigate to /dashboard so the tenancy redux state
 * re-bootstraps from scratch (the deleted org must drop out of the switcher).
 */
const OrganizationSettings = () => {
    const { organization, organizationId } = useTenancy();

    // Rename form.
    const [name, setName] = useState(organization?.name || '');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [saved, setSaved] = useState(false);

    // Create-organization modal.
    const [createOpen, setCreateOpen] = useState(false);
    const [createName, setCreateName] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState(null);

    // Delete-confirm modal.
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState(null);

    // Re-seed the rename field whenever the selected org changes.
    useEffect(() => { setName(organization?.name || ''); }, [organization?.name]);

    const handleSave = async () => {
        if(!name.trim() || !organizationId) return;
        setSaving(true);
        setSaveError(null);
        setSaved(false);
        try{
            await organizations.update({
                query: { params: { id: organizationId } },
                body: { name: name.trim() }
            });
            setSaved(true);
        }catch(err){
            setSaveError(errText(err, 'Failed to save organization.'));
        }finally{
            setSaving(false);
        }
    };

    const handleCreate = async () => {
        if(!createName.trim()) return;
        setCreating(true);
        setCreateError(null);
        try{
            await organizations.create({ body: { name: createName.trim() } });
            setCreateOpen(false);
            setCreateName('');
            // Force a tenancy re-bootstrap so the new org appears in the switcher.
            window.location.assign('/dashboard');
        }catch(err){
            setCreateError(errText(err, 'Failed to create organization.'));
            setCreating(false);
        }
    };

    const handleDelete = async () => {
        if(!organizationId) return;
        setDeleting(true);
        setDeleteError(null);
        try{
            await organizations.remove({ query: { params: { id: organizationId } } });
            // Hard navigate so tenancy redux re-bootstraps without the deleted org.
            window.location.assign('/dashboard');
        }catch(err){
            setDeleteError(errText(err, 'Failed to delete organization.'));
            setDeleting(false);
        }
    };

    const openCreate = () => {
        setCreateName('');
        setCreateError(null);
        setCreateOpen(true);
    };

    const createButton = (
        <Button variant='outline' onClick={openCreate}>
            <Plus className='h-4 w-4' /> Create organization
        </Button>
    );

    return (
        <div>
            <PageHeader
                title='Organization settings'
                subtitle='Rename the selected organization, create a new one, or delete it.'
                actions={createButton}
            />

            {/* Create-organization modal (always available). */}
            <Dialog open={createOpen} onOpenChange={(o) => { if(!o && !creating) setCreateOpen(false); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create organization</DialogTitle>
                    </DialogHeader>
                    <div className='flex flex-col gap-5'>
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium'>Name</label>
                            <Input
                                placeholder='my-organization'
                                value={createName}
                                onChange={(e) => setCreateName(e.target.value)}
                            />
                        </div>
                        {createError && <p className='text-sm text-destructive'>{createError}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !creating && setCreateOpen(false)}>
                            Cancel
                        </Button>
                        <Button disabled={creating || !createName.trim()} onClick={handleCreate}>
                            {creating ? 'Creating…' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {!organizationId ? (
                <EmptyState
                    icon={Settings}
                    title='No organization selected'
                    body='Use the organization switcher to pick one, or create a new organization below.'
                    action={createButton}
                />
            ) : (
                <div className='flex flex-col gap-7'>
                    {saved && (
                        <div className='flex items-center justify-between rounded-md border border-transparent bg-success/10 px-4 py-3 text-sm text-success'>
                            <span>Organization settings updated.</span>
                            <button type='button' onClick={() => setSaved(false)} className='text-success/70 hover:text-success'>✕</button>
                        </div>
                    )}

                    <Card>
                        <CardContent className='p-6'>
                            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                                <div className='flex flex-col gap-6'>
                                    <div className='space-y-1.5'>
                                        <label className='text-sm font-medium'>Name</label>
                                        <Input
                                            placeholder='my-organization'
                                            value={name}
                                            onChange={(e) => { setName(e.target.value); setSaved(false); }}
                                        />
                                    </div>
                                    <div className='space-y-1.5'>
                                        <label className='text-sm font-medium'>Slug</label>
                                        <Input value={organization?.slug || ''} readOnly />
                                        <p className='text-xs text-muted-foreground'>
                                            Auto-generated identifier. Read-only.
                                        </p>
                                    </div>
                                    {saveError && <p className='text-sm text-destructive'>{saveError}</p>}
                                    <div>
                                        <Button type='submit' disabled={saving || !name.trim()}>
                                            {saving ? 'Saving…' : 'Save'}
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Danger zone. */}
                    <Card className='border-destructive/40'>
                        <CardHeader>
                            <CardTitle className='text-destructive'>Danger zone</CardTitle>
                            <CardDescription>
                                Deleting an organization permanently removes it and all of its projects,
                                environments, and resources. This action cannot be undone.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                variant='destructive'
                                onClick={() => { setDeleteError(null); setDeleteOpen(true); }}
                            >
                                <Trash2 className='h-4 w-4' /> Delete organization
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Delete-confirm modal. */}
                    <Dialog open={deleteOpen} onOpenChange={(o) => { if(!o && !deleting) setDeleteOpen(false); }}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Delete organization</DialogTitle>
                                <DialogDescription>
                                    This permanently removes <strong className='text-foreground'>{organization?.name || 'this organization'}</strong> and
                                    everything inside it. This action cannot be undone.
                                </DialogDescription>
                            </DialogHeader>
                            {deleteError && <p className='text-sm text-destructive'>{deleteError}</p>}
                            <DialogFooter>
                                <Button variant='outline' onClick={() => !deleting && setDeleteOpen(false)}>
                                    Cancel
                                </Button>
                                <Button variant='destructive' disabled={deleting} onClick={handleDelete}>
                                    {deleting ? 'Deleting…' : 'Delete'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            )}
        </div>
    );
};

export default OrganizationSettings;
