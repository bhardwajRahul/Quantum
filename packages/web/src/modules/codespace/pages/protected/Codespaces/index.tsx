import { useState } from 'react';
import { Button, Table } from '@heroui/react';
import { Plus, Terminal } from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import LoadingState from '@/shared/components/LoadingState';
import ErrorState from '@/shared/components/ErrorState';
import EmptyState from '@/shared/components/EmptyState';
import ConfirmDialog from '@/shared/components/ConfirmDialog';
import ProjectSelect from '@/modules/codespace/components/ProjectSelect';
import CodespaceStatusChip from '@/modules/codespace/components/CodespaceStatus';
import CreateCodespaceDialog from '@/modules/codespace/components/CreateCodespaceDialog';
import CodespaceAccessDialog from '@/modules/codespace/components/CodespaceAccessDialog';
import { useQuery } from '@/shared/hooks/api/use-query';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { usePolledQuery } from '@/shared/hooks/api/use-polled-query';
import { codespaceApi } from '@/modules/codespace/api/api';
import { projectApi } from '@/modules/codespace/api/projects';
import { useCurrentOrganizationId } from '@/modules/organization/hooks/use-current-organization-id';
import { isCodespaceTransient } from '@/modules/codespace/utils/status';
import { codespaceErrorMessages } from '@/modules/codespace/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import type { Codespace } from '@quantum/contracts/modules/codespace/domain';

const copy = errorCopy(codespaceErrorMessages);

interface CodespacesHeaderProps{
    canAdd: boolean;
    onAdd: () => void;
}

const CodespacesHeader = ({ canAdd, onAdd }: CodespacesHeaderProps) => (
    <div className='flex items-center justify-between gap-4'>
        <div>
            <h1 className='text-lg font-medium text-foreground'>Codespaces</h1>
            <p className='mt-1.5 text-sm text-muted'>Cloud dev environments for a project.</p>
        </div>

        <Button isDisabled={!canAdd} onPress={onAdd}>
            <Plus aria-hidden='true' className='size-4' />
            New codespace
        </Button>
    </div>
);

interface DeleteCodespaceDialogProps{
    codespace: Codespace | null;
    onClose: () => void;
    onRemoved: () => void;
}

const DeleteCodespaceDialog = ({ codespace, onClose, onRemoved }: DeleteCodespaceDialogProps) => {
    const removeCodespace = useMutation((id: number) => codespaceApi.remove(id));

    const handleRemove = async () => {
        if(codespace === null) return;

        const removed = await removeCodespace.run(codespace.id).then(() => true, () => false);
        if(!removed) return;

        onClose();
        onRemoved();
    };

    return (
        <ConfirmDialog
            isOpen={codespace !== null}
            onOpenChange={(isOpen) => { if(!isOpen) onClose(); }}
            title='Delete codespace'
            description={codespace === null
                ? ''
                : `This permanently removes "${codespace.name}" and its container. This action cannot be undone.`}
            confirmLabel='Delete'
            isPending={removeCodespace.loading}
            error={copy(removeCodespace.error)}
            onConfirm={() => { void handleRemove(); }}
        />
    );
};

interface CodespacesTableProps{
    codespaces: Codespace[];
    onAccess: (codespace: Codespace) => void;
    onDelete: (codespace: Codespace) => void;
}

const CodespacesTable = ({ codespaces, onAccess, onDelete }: CodespacesTableProps) => (
    <Table aria-label='Codespaces'>
        <Table.Header>
            <Table.Column isRowHeader>Name</Table.Column>
            <Table.Column>Status</Table.Column>
            <Table.Column><span className='sr-only'>Actions</span></Table.Column>
        </Table.Header>

        <Table.Body>
            {codespaces.map((codespace) => (
                <Table.Row key={codespace.id}>
                    <Table.Cell><span className='font-medium text-foreground'>{codespace.name}</span></Table.Cell>
                    <Table.Cell><CodespaceStatusChip status={codespace.status} /></Table.Cell>
                    <Table.Cell>
                        <div className='flex justify-end gap-2'>
                            <Button
                                size='sm'
                                variant='secondary'
                                isDisabled={isCodespaceTransient(codespace.status)}
                                onPress={() => onAccess(codespace)}
                            >
                                Access
                            </Button>
                            <Button size='sm' variant='danger-soft' onPress={() => onDelete(codespace)}>Delete</Button>
                        </div>
                    </Table.Cell>
                </Table.Row>
            ))}
        </Table.Body>
    </Table>
);

const Codespaces = () => {
    const organizationId = useCurrentOrganizationId();
    const projects = useQuery(projectApi.listByOrganization, [organizationId ?? undefined]);
    const [projectId, setProjectId] = useState<number | null>(null);

    const codespacesQuery = useQuery(
        codespaceApi.listByProject,
        [projectId ?? undefined],
        { enabled: projectId !== null }
    );
    const codespaces = usePolledQuery(codespacesQuery, {
        while: (data) => data.some((codespace) => isCodespaceTransient(codespace.status)),
        everyMs: 5000
    });

    const [createOpen, setCreateOpen] = useState(false);
    const [accessTarget, setAccessTarget] = useState<Codespace | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Codespace | null>(null);

    if(organizationId === null) return <LoadingState title='Loading codespaces' compact />;
    if(projects.loading) return <LoadingState title='Loading projects' compact />;
    if(projects.error !== undefined){
        return <ErrorState title='Could not load projects' description={copy(projects.error)} onRetry={projects.reload} />;
    }

    const projectItems = projects.data ?? [];

    return (
        <PageBody width='wide'>
            <CodespacesHeader canAdd={projectId !== null} onAdd={() => setCreateOpen(true)} />

            <div className='mt-6 max-w-sm'>
                <ProjectSelect
                    projects={projectItems}
                    value={projectId}
                    onChange={setProjectId}
                />
            </div>

            <div className='mt-6'>
                {projectId === null ? (
                    <EmptyState
                        icon={Terminal}
                        title='Select a project'
                        description='Choose one of your projects above to view and manage its codespaces.'
                    />
                ) : codespaces.loading ? (
                    <LoadingState title='Loading codespaces' compact />
                ) : codespaces.error !== undefined ? (
                    <ErrorState
                        title='Could not load codespaces'
                        description={copy(codespaces.error)}
                        onRetry={codespaces.reload}
                    />
                ) : (codespaces.data ?? []).length === 0 ? (
                    <EmptyState
                        icon={Terminal}
                        title='No codespaces yet'
                        description='This project has no codespaces. Create one to get a cloud dev environment.'
                    >
                        <Button onPress={() => setCreateOpen(true)}>
                            <Plus aria-hidden='true' className='size-4' />
                            New codespace
                        </Button>
                    </EmptyState>
                ) : (
                    <CodespacesTable
                        codespaces={codespaces.data ?? []}
                        onAccess={setAccessTarget}
                        onDelete={setDeleteTarget}
                    />
                )}
            </div>

            {projectId !== null && (
                <CreateCodespaceDialog
                    projectId={projectId}
                    isOpen={createOpen}
                    onClose={setCreateOpen}
                    onCreated={codespaces.reload}
                />
            )}

            <CodespaceAccessDialog
                key={accessTarget?.id ?? 'access'}
                codespace={accessTarget}
                onClose={() => setAccessTarget(null)}
            />

            <DeleteCodespaceDialog
                codespace={deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onRemoved={codespaces.reload}
            />
        </PageBody>
    );
};

export default Codespaces;
