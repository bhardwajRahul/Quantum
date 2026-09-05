import { useState } from 'react';
import { Button, Chip, Table } from '@heroui/react';
import { Globe, Plus, RefreshCw } from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import LoadingState from '@/shared/components/LoadingState';
import ErrorState from '@/shared/components/ErrorState';
import EmptyState from '@/shared/components/EmptyState';
import CenterState from '@/shared/components/CenterState';
import InlineError from '@/shared/components/InlineError';
import ConfirmDialog from '@/shared/components/ConfirmDialog';
import DomainStatusChip from '@/modules/domain/components/DomainStatus';
import RepositorySelect from '@/modules/domain/components/RepositorySelect';
import CreateDomainDialog from '@/modules/domain/components/CreateDomainDialog';
import { useQuery } from '@/shared/hooks/api/use-query';
import { useResource } from '@/shared/hooks/api/use-resource';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { domainApi } from '@/modules/domain/api/api';
import { repositoryApi } from '@/modules/repository/api/api';
import { domainRoutes } from '@quantum/contracts/modules/domain/routes';
import { domainErrorMessages } from '@/modules/domain/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import type { Domain } from '@quantum/contracts/modules/domain/domain';
import type { UpdateDomainInput } from '@quantum/contracts/modules/domain/http';

const copy = errorCopy(domainErrorMessages);

interface DomainsHeaderProps{
    canRefresh: boolean;
    canAdd: boolean;
    refreshing: boolean;
    onRefresh: () => void;
    onAdd: () => void;
}

const DomainsHeader = ({ canRefresh, canAdd, refreshing, onRefresh, onAdd }: DomainsHeaderProps) => (
    <div className='flex items-center justify-between gap-4'>
        <div>
            <h1 className='text-lg font-medium text-foreground'>Domains</h1>
            <p className='mt-1.5 text-sm text-muted'>
                Bind custom domains to a repository. TLS is provisioned automatically.
            </p>
        </div>

        <div className='flex gap-2'>
            <Button variant='secondary' isDisabled={!canRefresh} isPending={refreshing} onPress={onRefresh}>
                <RefreshCw aria-hidden='true' className='size-4' />
                Refresh
            </Button>
            <Button isDisabled={!canAdd} onPress={onAdd}>
                <Plus aria-hidden='true' className='size-4' />
                Add domain
            </Button>
        </div>
    </div>
);

interface DeleteDomainDialogProps{
    domain: Domain | null;
    onClose: () => void;
    onRemoved: () => void;
}

const DeleteDomainDialog = ({ domain, onClose, onRemoved }: DeleteDomainDialogProps) => {
    const removeDomain = useMutation((id: number) => domainApi.remove({ path: { id } }));

    const handleRemove = async () => {
        if(domain === null) return;

        const removed = await removeDomain.run(domain.id).then(() => true, () => false);
        if(!removed) return;

        onClose();
        onRemoved();
    };

    return (
        <ConfirmDialog
            isOpen={domain !== null}
            onOpenChange={(isOpen) => { if(!isOpen) onClose(); }}
            title='Delete domain'
            description={domain === null
                ? ''
                : `Remove ${domain.host}? This stops routing traffic to it and releases its TLS certificate.`}
            confirmLabel='Delete'
            isPending={removeDomain.loading}
            error={copy(removeDomain.error)}
            onConfirm={() => { void handleRemove(); }}
        />
    );
};

interface DomainRowProps{
    domain: Domain;
    isBusy: boolean;
    onUpdate: (body: UpdateDomainInput) => void;
    onRemove: () => void;
}

const DomainRow = ({ domain, isBusy, onUpdate, onRemove }: DomainRowProps) => (
    <Table.Row>
        <Table.Cell>
            <span className='inline-flex items-center gap-2'>
                <span className='font-medium text-foreground'>{domain.host}</span>
                {domain.isPrimary && <Chip size='sm' variant='soft' color='accent'>Primary</Chip>}
            </span>
        </Table.Cell>
        <Table.Cell>{domain.kind}</Table.Cell>
        <Table.Cell><DomainStatusChip status={domain.status} /></Table.Cell>
        <Table.Cell>{domain.tls ? 'Enabled' : 'Off'}</Table.Cell>
        <Table.Cell>
            <div className='flex justify-end gap-2'>
                <Button
                    size='sm'
                    variant='secondary'
                    isDisabled={domain.isPrimary || isBusy}
                    onPress={() => onUpdate({ isPrimary: true })}
                >
                    Set as primary
                </Button>
                <Button
                    size='sm'
                    variant='secondary'
                    isDisabled={isBusy}
                    onPress={() => onUpdate({ tls: !domain.tls })}
                >
                    {domain.tls ? 'Disable TLS' : 'Enable TLS'}
                </Button>
                <Button size='sm' variant='danger-soft' onPress={onRemove}>Delete</Button>
            </div>
        </Table.Cell>
    </Table.Row>
);

interface DomainsTableProps{
    domains: Domain[];
    onChanged: () => void;
}

const DomainsTable = ({ domains, onChanged }: DomainsTableProps) => {
    const updateDomain = useMutation((id: number, body: UpdateDomainInput) => domainApi.update({ path: { id }, body }));
    const [deleteTarget, setDeleteTarget] = useState<Domain | null>(null);

    const applyUpdate = (domain: Domain, body: UpdateDomainInput) => {
        void updateDomain.run(domain.id, body).then(() => onChanged(), () => undefined);
    };

    return (
        <div className='flex flex-col gap-3'>
            <Table>
                <Table.ScrollContainer>
                    <Table.Content aria-label='Domains'>
                        <Table.Header>
                            <Table.Column isRowHeader>Host</Table.Column>
                            <Table.Column>Kind</Table.Column>
                            <Table.Column>Status</Table.Column>
                            <Table.Column>TLS</Table.Column>
                            <Table.Column><span className='sr-only'>Actions</span></Table.Column>
                        </Table.Header>

                        <Table.Body>
                            {domains.map((domain) => (
                                <DomainRow
                                    key={domain.id}
                                    domain={domain}
                                    isBusy={updateDomain.loading}
                                    onUpdate={(body) => applyUpdate(domain, body)}
                                    onRemove={() => setDeleteTarget(domain)}
                                />
                            ))}
                        </Table.Body>
                    </Table.Content>
                </Table.ScrollContainer>
            </Table>

            {updateDomain.error !== undefined && <InlineError>{copy(updateDomain.error)}</InlineError>}

            <p className='text-[0.8125rem] text-muted'>
                Status and TLS changes reconcile asynchronously — use Refresh after a moment to see the latest state.
            </p>

            <DeleteDomainDialog
                domain={deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onRemoved={onChanged}
            />
        </div>
    );
};

const Domains = () => {
    const repositories = useQuery(repositoryApi.mine, []);
    const [repositoryId, setRepositoryId] = useState<number | null>(null);
    const domains = useResource(domainRoutes, {
        list: 'listByRepository',
        request: repositoryId === null ? null : { path: { repositoryId } }
    });
    const [createOpen, setCreateOpen] = useState(false);

    if(repositories.loading) return <LoadingState title='Loading repositories' compact />;
    if(repositories.error !== undefined){
        return (
            <ErrorState
                title='Could not load repositories'
                description={copy(repositories.error)}
                onRetry={repositories.reload}
            />
        );
    }

    const items = repositories.data ?? [];
    const openCreate = () => setCreateOpen(true);

    return (
        <PageBody width='wide' height='full'>
            <DomainsHeader
                canRefresh={repositoryId !== null && !domains.loading}
                canAdd={items.length > 0}
                refreshing={domains.loading}
                onRefresh={domains.refresh}
                onAdd={openCreate}
            />

            <div className='mt-6 max-w-sm'>
                <RepositorySelect
                    repositories={items}
                    value={repositoryId}
                    onChange={setRepositoryId}
                />
            </div>

            <div className='mt-6 flex flex-1 flex-col'>
                {repositoryId === null ? (
                    <CenterState>
                        <EmptyState
                            icon={Globe}
                            title='Select a repository'
                            description='Choose one of your repositories above to view and manage its custom domains.'
                        />
                    </CenterState>
                ) : domains.loading ? (
                    <CenterState><LoadingState title='Loading domains' compact /></CenterState>
                ) : domains.error !== undefined ? (
                    <CenterState>
                        <ErrorState
                            title='Could not load domains'
                            description={copy(domains.error)}
                            onRetry={domains.refresh}
                        />
                    </CenterState>
                ) : (domains.data ?? []).length === 0 ? (
                    <CenterState>
                        <EmptyState
                            icon={Globe}
                            title='No domains yet'
                            description='This repository has no custom domains. Add one to route traffic and provision TLS.'
                        >
                            <Button onPress={openCreate}>
                                <Plus aria-hidden='true' className='size-4' />
                                Add domain
                            </Button>
                        </EmptyState>
                    </CenterState>
                ) : (
                    <DomainsTable domains={domains.data ?? []} onChanged={domains.refresh} />
                )}
            </div>

            {createOpen && (
                <CreateDomainDialog
                    repositories={items}
                    defaultRepositoryId={repositoryId}
                    onClose={() => setCreateOpen(false)}
                    onCreated={setRepositoryId}
                />
            )}
        </PageBody>
    );
};

export default Domains;
