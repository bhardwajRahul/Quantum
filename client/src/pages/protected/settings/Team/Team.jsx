import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
    PageHeader, EmptyState, DataTable, LoadingBlock, Pill, Button, RowActionsMenu, ConfirmDialog
} from '@components/atoms/kit';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { memberships } from '@services/platform/service';
import { useTenancy, useAsyncAction } from '@hooks/common';
import { errText } from '@utilities/common/errText';
import { userName, userEmail } from '@utilities/common/userDisplay';
import { unwrapList } from '@utilities/api/unwrap';

const ROLES = [
    { value: 'owner', label: 'Owner' },
    { value: 'admin', label: 'Admin' },
    { value: 'member', label: 'Member' },
    { value: 'viewer', label: 'Viewer' }
];

const ROLE_TONES = { owner: 'violet', admin: 'violet', viewer: 'gray' };
const roleTone = (role) => ROLE_TONES[String(role || '').toLowerCase()] || 'green';

const Team = () => {
    const { organizationId, organization } = useTenancy();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [items, setItems] = useState([]);

    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteUser, setInviteUser] = useState('');
    const [inviteRole, setInviteRole] = useState('member');

    const [roleTarget, setRoleTarget] = useState(null);
    const [roleValue, setRoleValue] = useState('member');

    const [removeTarget, setRemoveTarget] = useState(null);

    const invite = useAsyncAction({ fallback: 'Failed to add member. Check the user id is valid and not already a member.' });
    const changeRole = useAsyncAction({ fallback: 'Failed to update role.' });
    const remove = useAsyncAction({ onError: (msg) => toast.error(msg), fallback: 'Failed to remove member.' });

    const load = useCallback(async () => {
        if(!organizationId) return;
        setLoading(true);
        setError(null);
        try{
            const res = await memberships.listByOrg({ query: { params: { orgId: organizationId } } });
            setItems(unwrapList(res));
        }catch(err){
            setError(errText(err, 'Failed to load team members.'));
        }finally{
            setLoading(false);
        }
    }, [organizationId]);

    useEffect(() => { load(); }, [load]);

    const handleInvite = async () => {
        if(!inviteUser.trim()) return;
        const ok = await invite.run(() => memberships.invite({
            query: { params: { orgId: organizationId } },
            body: { user: inviteUser.trim(), role: inviteRole }
        }));
        if(ok){
            setInviteOpen(false);
            setInviteUser('');
            setInviteRole('member');
            toast.success('Member added to the organization.');
            await load();
        }
    };

    const openChangeRole = (m) => {
        setRoleTarget(m);
        setRoleValue(String(m.role || 'member').toLowerCase());
        changeRole.clearError();
    };

    const handleChangeRole = async () => {
        if(!roleTarget) return;
        const ok = await changeRole.run(() => memberships.updateRole({
            query: { params: { orgId: organizationId, id: roleTarget._id } },
            body: { role: roleValue }
        }));
        if(ok){
            setRoleTarget(null);
            toast.success('Member role updated.');
            await load();
        }
    };

    const handleRemove = async () => {
        if(!removeTarget) return;
        const ok = await remove.run(() => memberships.remove({
            query: { params: { orgId: organizationId, id: removeTarget._id } }
        }));
        if(ok){
            setRemoveTarget(null);
            toast.success('Member removed from the organization.');
            await load();
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

    const memberName = (m) => userName(m.user);

    const initials = (label) => {
        const s = String(label || '').trim();
        if(!s || s === '—') return '?';
        return s.slice(0, 2).toUpperCase();
    };

    const rows = useMemo(() => items.map((m) => ({
        id: String(m._id),
        member: memberName(m),
        email: userEmail(m.user),
        role: m.role || 'member',
        scope: m.project ? 'Project' : 'Organization',
        _m: m
    })), [items]);

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
        <RowActionsMenu items={[
            { label: 'Change role', onClick: () => openChangeRole(row._m) },
            { label: 'Remove', danger: true, onClick: () => setRemoveTarget(row._m) }
        ]} />
    );

    return (
        <div>
            <PageHeader
                title='Team'
                subtitle={organization?.name ? `Members of ${organization.name}.` : 'Manage who can access this organization.'}
                actions={(
                    <Button onClick={() => { invite.clearError(); setInviteOpen(true); }}>
                        <Plus className='h-4 w-4' /> Invite member
                    </Button>
                )}
            />

            <Dialog open={inviteOpen} onOpenChange={(o) => { if(!o && !invite.pending) setInviteOpen(false); }}>
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
                            <Select value={inviteRole} onValueChange={setInviteRole}>
                                <SelectTrigger>
                                    <SelectValue placeholder='Select a role' />
                                </SelectTrigger>
                                <SelectContent>
                                    {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {invite.error && <p className='text-sm text-destructive'>{invite.error}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !invite.pending && setInviteOpen(false)}>
                            Cancel
                        </Button>
                        <Button disabled={invite.pending || !inviteUser.trim()} onClick={handleInvite}>
                            {invite.pending ? 'Adding…' : 'Add member'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!roleTarget} onOpenChange={(o) => { if(!o && !changeRole.pending) setRoleTarget(null); }}>
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
                            <Select value={roleValue} onValueChange={setRoleValue}>
                                <SelectTrigger>
                                    <SelectValue placeholder='Select a role' />
                                </SelectTrigger>
                                <SelectContent>
                                    {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {changeRole.error && <p className='text-sm text-destructive'>{changeRole.error}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !changeRole.pending && setRoleTarget(null)}>
                            Cancel
                        </Button>
                        <Button disabled={changeRole.pending} onClick={handleChangeRole}>
                            {changeRole.pending ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={!!removeTarget}
                onCancel={() => setRemoveTarget(null)}
                onConfirm={handleRemove}
                title='Remove member'
                description={removeTarget ? `This removes ${memberName(removeTarget)} from the organization. They will lose access to its projects.` : ''}
                pending={remove.pending}
                destructive
                confirmLabel='Remove'
                pendingLabel='Removing…'
            />

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
                        <Button onClick={() => { invite.clearError(); setInviteOpen(true); }}>
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
