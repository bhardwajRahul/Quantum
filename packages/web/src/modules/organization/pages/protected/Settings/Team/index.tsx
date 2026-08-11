import { useState } from 'react';
import { Button, Label, Table } from '@heroui/react';
import { Plus, Users } from 'lucide-react';
import typia from 'typia';
import PageBody from '@/shared/components/layout/PageBody';
import LoadingState from '@/shared/components/LoadingState';
import ErrorState from '@/shared/components/ErrorState';
import EmptyState from '@/shared/components/EmptyState';
import InlineError from '@/shared/components/InlineError';
import ConfirmDialog from '@/shared/components/ConfirmDialog';
import Modal from '@/shared/components/Modal';
import Form from '@/shared/components/forms/Form';
import Field from '@/shared/components/forms/Field';
import RoleSelect from '@/modules/organization/components/RoleSelect';
import { useForm } from '@/shared/hooks/forms/use-form';
import { useQuery } from '@/shared/hooks/api/use-query';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { organizationApi } from '@/modules/organization/api/api';
import { useCurrentOrganizationId } from '@/modules/organization/hooks/use-current-organization-id';
import { useTenancy } from '@/modules/organization/hooks/use-tenancy';
import { tenancyErrorMessages } from '@/modules/organization/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import type { Member } from '@quantum/contracts/modules/organization/domain';
import type { InviteMemberInput, UpdateMemberInput } from '@quantum/contracts/modules/organization/http';

const copy = errorCopy(tenancyErrorMessages);

interface InviteMemberDialogProps{
    organizationId: number;
    onClose: () => void;
    onInvited: () => void;
}

const InviteMemberDialog = ({ organizationId, onClose, onInvited }: InviteMemberDialogProps) => {
    const form = useForm<InviteMemberInput>({
        validate: typia.createValidate<InviteMemberInput>(),
        submitErrorMessages: tenancyErrorMessages,
        initialValues: { email: '', role: OrganizationRole.Member },
        onSubmit: async (values) => {
            await organizationApi.invite(organizationId, values);
            onInvited();
            onClose();
        }
    });

    return (
        <Modal isOpen onOpenChange={(isOpen) => { if(!isOpen && !form.submitting) onClose(); }} title='Invite member'>
            <Form form={form} className='flex flex-col gap-4'>
                <Field form={form} name='email' label='Email' type='email' placeholder='teammate@quantum.dev' autoComplete='off' />

                <Field form={form} name='role'>
                    {(binding) => (
                        <div className='flex flex-col gap-1.5'>
                            <Label>Role</Label>
                            <RoleSelect
                                value={binding.value as OrganizationRole}
                                onChange={binding.onChange}
                                isDisabled={form.submitting}
                            />
                        </div>
                    )}
                </Field>

                <div className='flex justify-end gap-2'>
                    <Button variant='secondary' isDisabled={form.submitting} onPress={onClose}>Cancel</Button>
                    <Button type='submit' isPending={form.submitting}>Add member</Button>
                </div>
            </Form>
        </Modal>
    );
};

interface TeamHeaderProps{
    organizationName: string | null;
    onInvite: () => void;
}

const TeamHeader = ({ organizationName, onInvite }: TeamHeaderProps) => (
    <div className='flex items-center justify-between gap-4'>
        <div>
            <h1 className='text-lg font-medium text-foreground'>Team</h1>
            <p className='mt-1.5 text-sm text-muted'>
                {organizationName !== null
                    ? `Members of ${organizationName}.`
                    : 'Manage who can access this organization.'}
            </p>
        </div>

        <Button onPress={onInvite}>
            <Plus aria-hidden='true' className='size-4' />
            Invite member
        </Button>
    </div>
);

const MembersEmpty = ({ onInvite }: { onInvite: () => void }) => (
    <EmptyState
        icon={Users}
        title='No members yet'
        description='Invite an existing Quantum user to collaborate in this organization.'
    >
        <Button onPress={onInvite}>
            <Plus aria-hidden='true' className='size-4' />
            Invite member
        </Button>
    </EmptyState>
);

interface TeamRowProps{
    member: Member;
    isBusy: boolean;
    onRoleChange: (role: OrganizationRole) => void;
    onRemove: () => void;
}

const TeamRow = ({ member, isBusy, onRoleChange, onRemove }: TeamRowProps) => {
    const isOwner = member.role === OrganizationRole.Owner;

    return (
        <Table.Row>
            <Table.Cell>
                <span className='font-medium text-foreground'>{member.username}</span>
                {member.fullname !== '' && <span className='ml-2 text-muted'>{member.fullname}</span>}
            </Table.Cell>
            <Table.Cell>{member.email}</Table.Cell>
            <Table.Cell>
                <RoleSelect
                    ariaLabel={`Role of ${member.username}`}
                    value={member.role}
                    isDisabled={isOwner || isBusy}
                    onChange={onRoleChange}
                />
            </Table.Cell>
            <Table.Cell>
                <Button variant='secondary' isDisabled={isOwner} onPress={onRemove}>Remove</Button>
            </Table.Cell>
        </Table.Row>
    );
};

interface RemoveMemberDialogProps{
    organizationId: number;
    member: Member | null;
    onClose: () => void;
    onRemoved: () => void;
}

const RemoveMemberDialog = ({ organizationId, member, onClose, onRemoved }: RemoveMemberDialogProps) => {
    const removeMember = useMutation((memberId: number) => organizationApi.removeMember(organizationId, memberId));

    const handleRemove = async () => {
        if(member === null) return;

        const removed = await removeMember.run(member.id).then(() => true, () => false);
        if(!removed) return;

        onClose();
        onRemoved();
    };

    return (
        <ConfirmDialog
            isOpen={member !== null}
            onOpenChange={(isOpen) => { if(!isOpen) onClose(); }}
            title='Remove member'
            description={member === null
                ? ''
                : `This removes ${member.username} from the organization. They will lose access to its projects.`}
            confirmLabel='Remove'
            isPending={removeMember.loading}
            error={copy(removeMember.error)}
            onConfirm={() => { void handleRemove(); }}
        />
    );
};

interface TeamTableProps{
    organizationId: number;
    members: Member[];
    onChanged: () => void;
}

const TeamTable = ({ organizationId, members, onChanged }: TeamTableProps) => {
    const updateRole = useMutation((memberId: number, body: UpdateMemberInput) =>
        organizationApi.updateMember(organizationId, memberId, body));
    const [removeTarget, setRemoveTarget] = useState<Member | null>(null);

    const changeRole = (member: Member, role: OrganizationRole) => {
        void updateRole.run(member.id, { role }).then(() => onChanged(), () => undefined);
    };

    return (
        <div className='flex flex-col gap-3'>
            <Table aria-label='Team members'>
                <Table.Header>
                    <Table.Column isRowHeader>Member</Table.Column>
                    <Table.Column>Email</Table.Column>
                    <Table.Column>Role</Table.Column>
                    <Table.Column><span className='sr-only'>Actions</span></Table.Column>
                </Table.Header>

                <Table.Body>
                    {members.map((member) => (
                        <TeamRow
                            key={member.id}
                            member={member}
                            isBusy={updateRole.loading}
                            onRoleChange={(role) => changeRole(member, role)}
                            onRemove={() => setRemoveTarget(member)}
                        />
                    ))}
                </Table.Body>
            </Table>

            {updateRole.error !== undefined && <InlineError>{copy(updateRole.error)}</InlineError>}

            <RemoveMemberDialog
                organizationId={organizationId}
                member={removeTarget}
                onClose={() => setRemoveTarget(null)}
                onRemoved={onChanged}
            />
        </div>
    );
};

const Team = () => {
    const organizationId = useCurrentOrganizationId();
    const { current } = useTenancy();
    const members = useQuery(organizationApi.members, [organizationId ?? undefined]);
    const [inviteOpen, setInviteOpen] = useState(false);

    if(organizationId === null) return <LoadingState title='Loading team' compact />;
    if(members.loading) return <LoadingState title='Loading team members' compact />;
    if(members.error !== undefined){
        return <ErrorState title='Could not load team members' description={copy(members.error)} onRetry={members.reload} />;
    }

    const items = members.data ?? [];

    return (
        <PageBody width='wide'>
            <TeamHeader organizationName={current?.name ?? null} onInvite={() => setInviteOpen(true)} />

            <div className='mt-6'>
                {items.length === 0 ? (
                    <MembersEmpty onInvite={() => setInviteOpen(true)} />
                ) : (
                    <TeamTable organizationId={organizationId} members={items} onChanged={members.reload} />
                )}
            </div>

            {inviteOpen && (
                <InviteMemberDialog
                    organizationId={organizationId}
                    onClose={() => setInviteOpen(false)}
                    onInvited={members.reload}
                />
            )}
        </PageBody>
    );
};

export default Team;
