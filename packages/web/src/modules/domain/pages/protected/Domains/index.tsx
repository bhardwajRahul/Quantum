import { useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useRememberedSelection } from '@/shared/hooks/use-remembered-selection';
import { Button, Chip, Table } from '@heroui/react';
import { ArrowRight, Globe, RefreshCw } from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import PageHeader from '@/shared/components/layout/PageHeader';
import ListPageShell from '@/shared/components/ListPageShell';
import InlineError from '@/shared/components/InlineError';
import DeleteConfirmDialog from '@/shared/components/DeleteConfirmDialog';
import DomainStatusChip from '@/modules/domain/components/DomainStatus';
import EntitySelect from '@/shared/components/EntitySelect';
import CreateDomainDialog from '@/modules/domain/components/CreateDomainDialog';
import CreateUpstreamDialog from '@/modules/domain/components/CreateUpstreamDialog';
import { useQuery } from '@/shared/hooks/api/use-query';
import { useResource } from '@/shared/hooks/api/use-resource';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { domainApi } from '@/modules/domain/api/api';
import { repositoryApi } from '@/modules/repository/api/api';
import { domainRoutes } from '@quantum/contracts/modules/domain/routes';
import { domainErrorMessages } from '@/modules/domain/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import { DomainTarget } from '@quantum/contracts/modules/domain/domain';
import type { Domain } from '@quantum/contracts/modules/domain/domain';
import type { UpdateDomainInput } from '@quantum/contracts/modules/domain/http';

const copy = errorCopy(domainErrorMessages);

interface DomainsHeaderProps{
    filter: ReactNode;
    canRefresh: boolean;
    canAdd: boolean;
    refreshing: boolean;
    onRefresh: () => void;
    onAdd: () => void;
}

const DomainsHeader = ({ filter, canRefresh, canAdd, refreshing, onRefresh, onAdd }: DomainsHeaderProps) => (
    <PageHeader
        title='Domains'
        description='Bind custom domains to a repository. TLS is provisioned automatically.'
        filter={filter}
        actions={(
            <div className='flex gap-2'>
                <Button variant='secondary' isDisabled={!canRefresh} isPending={refreshing} onPress={onRefresh}>
                    <RefreshCw aria-hidden='true' className='size-4' />
                    Refresh
                </Button>
                <Button isDisabled={!canAdd} onPress={onAdd}>
                    Add domain
                    <ArrowRight aria-hidden='true' className='size-4' />
                </Button>
            </div>
        )}
    />
);

interface DeleteDomainDialogProps{
    domain: Domain | null;
    onClose: () => void;
    onRemoved: () => void;
    onOptimisticRemove: () => () => void;
}

const DeleteDomainDialog = ({ domain, onClose, onRemoved, onOptimisticRemove }: DeleteDomainDialogProps) => (
    <DeleteConfirmDialog
        isOpen={domain !== null}
        title='Delete domain'
        description={domain === null
            ? ''
            : `Remove ${domain.host}? This stops routing traffic to it and releases its TLS certificate.`}
        entityId={domain?.id ?? null}
        remove={(id) => domainApi.remove({ path: { id } })}
        getErrorMessage={copy}
        optimistic={onOptimisticRemove}
        onClose={onClose}
        onRemoved={onRemoved}
    />
);

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
                <span className='font-mono text-[0.8125rem] text-foreground'>{domain.host}</span>
                {domain.isPrimary && <Chip size='sm' variant='soft' color='accent'>Primary</Chip>}
            </span>
        </Table.Cell>
        <Table.Cell>
            {domain.target === DomainTarget.Upstream
                ? <span className='font-mono text-[0.8125rem] text-muted'>{domain.upstreamUrl}</span>
                : <span className='text-[0.8125rem] text-muted'>{domain.kind}</span>}
        </Table.Cell>
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
                <Button size='sm' variant='danger' onPress={onRemove}>Delete</Button>
            </div>
        </Table.Cell>
    </Table.Row>
);

interface DomainsTableProps{
    domains: Domain[];
    onChanged: () => void;
    onOptimisticRemove: (id: number) => () => void;
}

const DomainsTable = ({ domains, onChanged, onOptimisticRemove }: DomainsTableProps) => {
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
                            <Table.Column>Target</Table.Column>
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
                onOptimisticRemove={() => onOptimisticRemove(deleteTarget?.id ?? -1)}
            />
        </div>
    );
};

type Mode = 'apps' | 'proxy';

interface ModeSwitchProps{
    mode: Mode;
    onChange: (mode: Mode) => void;
}

const ModeSwitch = ({ mode, onChange }: ModeSwitchProps) => (
    <div className='inline-flex h-9 border border-border'>
        {([['apps', 'Deployed apps'], ['proxy', 'Proxied hosts']] as const).map(([value, label], index) => (
            <button
                key={value}
                type='button'
                onClick={() => onChange(value)}
                aria-current={mode === value}
                className={`label-caps px-3.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
                    index > 0 ? 'border-l border-border ' : ''
                }${mode === value ? 'bg-foreground text-background' : 'text-muted hover:text-foreground'}`}
            >
                {label}
            </button>
        ))}
    </div>
);

const ProxiedHosts = () => {
    const upstreams = useResource(domainRoutes, { list: 'listUpstreams' });
    const [createOpen, setCreateOpen] = useState(false);

    return (
        <div className='flex flex-1 flex-col'>
            <div className='flex justify-end'>
                <Button onPress={() => setCreateOpen(true)}>
                    Add route
                    <ArrowRight aria-hidden='true' className='size-4' />
                </Button>
            </div>

            <div className='mt-4 flex flex-1 flex-col'>
                <ListPageShell
                    loading={upstreams.loading}
                    loadingTitle='Loading routes'
                    error={upstreams.error}
                    errorTitle='Could not load routes'
                    getErrorDescription={copy}
                    onRetry={upstreams.refresh}
                    isEmpty={(upstreams.data ?? []).length === 0}
                    empty={{
                        icon: Globe,
                        title: 'No proxied hosts yet',
                        description: 'Point a hostname at anything this server can reach — a container, another machine on the network, a device on the LAN.',
                        action: (
                            <Button onPress={() => setCreateOpen(true)}>
                                Add route
                                <ArrowRight aria-hidden='true' className='size-4' />
                            </Button>
                        )
                    }}
                >
                    <DomainsTable
                        domains={upstreams.data ?? []}
                        onChanged={upstreams.refresh}
                        onOptimisticRemove={(id) => upstreams.patch((items) => items.filter((item) => item.id !== id))}
                    />
                </ListPageShell>
            </div>

            {createOpen && (
                <CreateUpstreamDialog
                    onClose={() => setCreateOpen(false)}
                    onCreated={upstreams.refresh}
                />
            )}
        </div>
    );
};

const Domains = () => {
    const repositories = useQuery(repositoryApi.mine, []);
    const itemsIds = useMemo(() => (repositories.data ?? []).map((entry) => entry.id), [repositories.data]);
    const [repositoryId, setRepositoryId] = useRememberedSelection<number>('domains.repository', itemsIds);
    const domains = useResource(domainRoutes, {
        list: 'listByRepository',
        request: repositoryId === null ? null : { path: { repositoryId } }
    });
    const [createOpen, setCreateOpen] = useState(false);
    const [mode, setMode] = useState<Mode>('apps');

    if(repositories.loading || repositories.error !== undefined){
        return (
            <ListPageShell
                bare
                loading={repositories.loading}
                loadingTitle='Loading repositories'
                error={repositories.error}
                errorTitle='Could not load repositories'
                getErrorDescription={copy}
                onRetry={repositories.reload}
            />
        );
    }

    const items = repositories.data ?? [];
    const openCreate = () => setCreateOpen(true);

    return (
        <PageBody width='wide' height='full'>
            <DomainsHeader
                filter={<ModeSwitch mode={mode} onChange={setMode} />}
                canRefresh={repositoryId !== null && !domains.loading}
                canAdd={items.length > 0}
                refreshing={domains.loading}
                onRefresh={domains.refresh}
                onAdd={openCreate}
            />

            {mode === 'proxy' ? <div className='mt-6 flex flex-1 flex-col'><ProxiedHosts /></div> : (
            <>
            <div className='mt-6 max-w-sm'>
                <EntitySelect
                    items={items}
                    getKey={(repository) => repository.id}
                    getLabel={(repository) => repository.name !== '' ? repository.name : repository.alias}
                    value={repositoryId}
                    onChange={(key) => setRepositoryId(Number(key))}
                    placeholder='Select a repository'
                    ariaLabel='Repository'
                />
            </div>

            <div className='mt-6 flex flex-1 flex-col'>
                <ListPageShell
                    loading={domains.loading}
                    loadingTitle='Loading domains'
                    error={domains.error}
                    errorTitle='Could not load domains'
                    getErrorDescription={copy}
                    onRetry={domains.refresh}
                    showPrompt={repositoryId === null}
                    prompt={{
                        icon: Globe,
                        title: 'Select a repository',
                        description: 'Choose one of your repositories above to view and manage its custom domains.'
                    }}
                    isEmpty={(domains.data ?? []).length === 0}
                    empty={{
                        icon: Globe,
                        title: 'No domains yet',
                        description: 'This repository has no custom domains. Add one to route traffic and provision TLS.',
                        action: (
                            <Button onPress={openCreate}>
                                Add domain
                                <ArrowRight aria-hidden='true' className='size-4' />
                            </Button>
                        )
                    }}
                >
                    <DomainsTable
                        domains={domains.data ?? []}
                        onChanged={domains.refresh}
                        onOptimisticRemove={(id) => domains.patch((items) => items.filter((item) => item.id !== id))}
                    />
                </ListPageShell>
            </div>

            {createOpen && (
                <CreateDomainDialog
                    repositories={items}
                    defaultRepositoryId={repositoryId}
                    onClose={() => setCreateOpen(false)}
                    onCreated={setRepositoryId}
                />
            )}
            </>
            )}
        </PageBody>
    );
};

export default Domains;
