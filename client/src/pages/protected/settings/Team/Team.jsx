/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
****/

import { useState, useEffect, useCallback } from 'react';
import { Plus, Users, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import {
    PageHeader, EmptyState, DataTable, LoadingBlock, Pill, Button
} from '@components/atoms/kit';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from '@/components/ui/select';
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { memberships } from '@services/platform/service';
import useTenancy from '@hooks/common/useTenancy';
import { errText } from '@utilities/common/errText';

const ROLES = [
    { value: 'owner', label: 'Owner' },
    { value: 'admin', label: 'Admin' },
    { value: 'member', label: 'Member' },
    { value: 'viewer', label: 'Viewer' }
];

const roleTone = (role) => {
    const r = String(role || '').toLowerCase();
    if(r === 'owner') return 'violet';
    if(r === 'admin') return 'violet';
    if(r === 'viewer') return 'gray';
    return 'green';
};

/**
 * Team / Members — organization roster. Lists every membership for the selected
 * org and lets an admin invite an existing Quantum user by id, change a member's
 * role, or remove them. Org-scoped: requires an organization to be selected.
 */
const Team = () => {
    const { organizationId, organization } = useTenancy();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [items, setItems] = useState([]);

    // Invite modal.
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteUser, setInviteUser] = useState('');
    const [inviteRole, setInviteRole] = useState('member');
    const [inviting, setInviting] = useState(false);
    const [inviteError, setInviteError] = useState(null);

    // Change-role modal.
    const [roleTarget, setRoleTarget] = useState(null);
    const [roleValue, setRoleValue] = useState('member');
    const [savingRole, setSavingRole] = useState(false);
    const [roleError, setRoleError] = useState(null);

    // Remove-confirm modal.
    const [removeTarget, setRemoveTarget] = useState(null);
    const [removing, setRemoving] = useState(false);

    const load = useCallback(async () => {
        if(!organizationId) return;
        setLoading(true);
        setError(null);
        try{
            const res = await memberships.listByOrg({ query: { params: { orgId: organizationId } } });
            setItems(res?.data || []);
        }catch(err){
            setError(errText(err, 'Failed to load team members.'));
        }finally{
            setLoading(false);
        }
    }, [organizationId]);

    useEffect(() => { load(); }, [load]);

    const handleInvite = async () => {
        if(!inviteUser.trim()) return;
        setInviting(true);
        setInviteError(null);
        try{
            await memberships.invite({
                query: { params: { orgId: organizationId } },
                body: { user: inviteUser.trim(), role: inviteRole }
            });
            setInviteOpen(false);
            setInviteUser('');
            setInviteRole('member');
            toast.success('Member added to the organization.');
            await load();
        }catch(err){
            setInviteError(errText(err, 'Failed to add member. Check the user id is valid and not already a member.'));
        }finally{
            setInviting(false);
        }
    };

    const openChangeRole = (m) => {
        setRoleTarget(m);
        setRoleValue(String(m.role || 'member').toLowerCase());
        setRoleError(null);
    };

    const handleChangeRole = async () => {
        if(!roleTarget) return;
        setSavingRole(true);
        setRoleError(null);
        try{
            await memberships.updateRole({
                query: { params: { orgId: organizationId, id: roleTarget._id } },
                body: { role: roleValue }
            });
            setRoleTarget(null);
            toast.success('Member role updated.');
            await load();
        }catch(err){
            setRoleError(errText(err, 'Failed to update role.'));
        }finally{
            setSavingRole(false);
        }
    };

    const handleRemove = async () => {
        if(!removeTarget) return;
        setRemoving(true);
        try{
            await memberships.remove({ query: { params: { orgId: organizationId, id: removeTarget._id } } });
            setRemoveTarget(null);
            toast.success('Member removed from the organization.');
            await load();
        }catch(err){
            toast.error(errText(err, 'Failed to remove member.'));
        }finally{
            setRemoving(false);
        }
    };

    if(!organizationId){
        return (
            <div>
                <EmptyState
                    icon={Users}
                    title='No organization'
                    body='Create an organization to invite teammates.'
                />
            </div>
        );
    }

    const memberName = (m) => m.user?.username || m.user?.email || (typeof m.user === 'string' ? m.user : m.user?._id) || '—';

    const initials = (label) => {
        const s = String(label || '').trim();
        if(!s || s === '—') return '?';
        return s.slice(0, 2).toUpperCase();
    };

    const rows = items.map((m) => ({
        id: String(m._id),
        member: memberName(m),
        email: m.user?.email || '—',
        role: m.role || 'member',
        scope: m.project ? 'Project' : 'Organization',
        _m: m
    }));

    const columns = [
        {
            key: 'member',
            header: 'Member',
            render: (row) => (
                <div className='flex items-center gap-3'>
                    <Avatar className='h-8 w-8'>
                        <AvatarFallback className='text-xs'>{initials(row.member)}</AvatarFallback>
                    </Avatar>
                    <span className='font-medium text-foreground'>{row.member}</span>
                </div>
            )
        },
        { key: 'email', header: 'Email' },
        {
            key: 'role',
            header: 'Role',
            render: (row) => <Pill tone={roleTone(row.role)}>{row.role}</Pill>
        },
        { key: 'scope', header: 'Scope' }
    ];

    const rowActions = (row) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon'>
                    <MoreVertical className='h-4 w-4' />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
                <DropdownMenuItem onClick={() => openChangeRole(row._m)}>Change role</DropdownMenuItem>
                <DropdownMenuItem className='text-destructive' onClick={() => setRemoveTarget(row._m)}>Remove</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    return (
        <div>
            <PageHeader
                title='Team'
                subtitle={organization?.name ? `Members of ${organization.name}.` : 'Manage who can access this organization.'}
                actions={(
                    <Button onClick={() => { setInviteError(null); setInviteOpen(true); }}>
                        <Plus className='h-4 w-4' /> Invite member
                    </Button>
                )}
            />

            {/* Invite modal. */}
            <Dialog open={inviteOpen} onOpenChange={(o) => { if(!o && !inviting) setInviteOpen(false); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Invite member</DialogTitle>
                    </DialogHeader>
                    <div className='flex flex-col gap-5'>
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium'>User ID</label>
                            <Input
                                placeholder='64f0c9…'
                                value={inviteUser}
                                onChange={(e) => setInviteUser(e.target.value)}
                            />
                            <p className='text-xs text-muted-foreground'>
                                The ID of an existing Quantum user to add to this organization.
                            </p>
                        </div>
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium'>Role</label>
                            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder='Select a role' />
                                </SelectTrigger>
                                <SelectContent>
                                    {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {inviteError && <p className='text-sm text-destructive'>{inviteError}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !inviting && setInviteOpen(false)}>
                            Cancel
                        </Button>
                        <Button disabled={inviting || !inviteUser.trim()} onClick={handleInvite}>
                            {inviting ? 'Adding…' : 'Add member'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Change-role modal. */}
            <Dialog open={!!roleTarget} onOpenChange={(o) => { if(!o && !savingRole) setRoleTarget(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change role</DialogTitle>
                        <DialogDescription>
                            Update the role for <strong className='text-foreground'>{roleTarget ? memberName(roleTarget) : ''}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className='flex flex-col gap-5'>
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium'>Role</label>
                            <Select value={roleValue} onValueChange={(v) => setRoleValue(v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder='Select a role' />
                                </SelectTrigger>
                                <SelectContent>
                                    {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {roleError && <p className='text-sm text-destructive'>{roleError}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !savingRole && setRoleTarget(null)}>
                            Cancel
                        </Button>
                        <Button disabled={savingRole} onClick={handleChangeRole}>
                            {savingRole ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Remove-confirm modal. */}
            <Dialog open={!!removeTarget} onOpenChange={(o) => { if(!o && !removing) setRemoveTarget(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove member</DialogTitle>
                        <DialogDescription>
                            This removes <strong className='text-foreground'>{removeTarget ? memberName(removeTarget) : ''}</strong> from the organization.
                            They will lose access to its projects.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !removing && setRemoveTarget(null)}>
                            Cancel
                        </Button>
                        <Button variant='destructive' disabled={removing} onClick={handleRemove}>
                            {removing ? 'Removing…' : 'Remove'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {loading ? (
                <LoadingBlock label='Loading team members' />
            ) : error ? (
                <p className='text-sm text-destructive'>{error}</p>
            ) : rows.length === 0 ? (
                <EmptyState
                    icon={Users}
                    title='No members yet'
                    body='Invite an existing Quantum user to collaborate in this organization.'
                    action={(
                        <Button onClick={() => { setInviteError(null); setInviteOpen(true); }}>
                            <Plus className='h-4 w-4' /> Invite member
                        </Button>
                    )}
                />
            ) : (
                <DataTable columns={columns} rows={rows} actions={rowActions} />
            )}
        </div>
    );
};

export default Team;
