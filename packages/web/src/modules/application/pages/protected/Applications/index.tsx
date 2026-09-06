import { useEffect, useState } from 'react';
import { LinesSkeleton, PageSkeleton, TableSkeleton } from '@/shared/components/skeletons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Dropdown, Input, Label, ListBox, ListBoxItem, Select, Table, TextField } from '@heroui/react';
import {
    AppWindow,
    ArrowRight,
    Check,
    Copy,
    Database as DatabaseIcon,
    Eye,
    EyeOff,
    FileCode2,
    MoreVertical
} from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import PageHeader from '@/shared/components/layout/PageHeader';
import ListPageShell from '@/shared/components/ListPageShell';
import ErrorState from '@/shared/components/ErrorState';
import CenterState from '@/shared/components/CenterState';
import StatusDot from '@/shared/components/StatusDot';
import DeleteConfirmDialog from '@/shared/components/DeleteConfirmDialog';
import Modal from '@/shared/components/Modal';
import InlineError from '@/shared/components/InlineError';
import EntitySelect from '@/shared/components/EntitySelect';
import InternalAddress from '@/shared/components/InternalAddress';
import { useQuery } from '@/shared/hooks/api/use-query';
import { useResource } from '@/shared/hooks/api/use-resource';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { usePolledQuery } from '@/shared/hooks/api/use-polled-query';
import { repositoryApi } from '@/modules/repository/api/api';
import { databaseApi } from '@/modules/database/api/api';
import { templateInstallApi } from '@/modules/template/api/api';
import { projectRoutes } from '@quantum/contracts/modules/project/routes';
import { repositoryRoutes } from '@quantum/contracts/modules/repository/routes';
import { templateInstallRoutes } from '@quantum/contracts/modules/template/routes';
import { installStatusColor, installStatusLabel, isInstallRunning, isInstallTransient } from '@/modules/template/utils/install-status';
import { PortBindingProtocol } from '@quantum/contracts/modules/docker/domain';
import type { RepositoryPort } from '@quantum/contracts/modules/repository/domain';
import type { TemplateInstallOperation } from '@quantum/contracts/modules/template/http';
import { useCurrentOrganizationId } from '@/modules/organization/hooks/use-current-organization-id';
import { databaseStatusColor, databaseStatusLabel, isDatabaseTransient } from '@/modules/application/utils/status';
import { containerStatusColor, containerStatusLabel, isContainerTransient } from '@/modules/application/utils/container-status';
import PublishedPorts from '@/modules/repository/components/PublishedPorts';
import { formatDate } from '@/shared/utils/format-date';
import { copyText } from '@/shared/utils/clipboard';
import { applicationErrorMessages } from '@/modules/application/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import { DatabaseEngine } from '@quantum/contracts/modules/database/domain';
import type { Database } from '@quantum/contracts/modules/database/domain';
import type { CreateDatabaseInput } from '@quantum/contracts/modules/database/http';
import type { Repository } from '@quantum/contracts/modules/repository/domain';
import type { TemplateInstall, TemplateInstallService } from '@quantum/contracts/modules/template/domain';

const copy = errorCopy(applicationErrorMessages);

const ENGINE_LABEL: Record<DatabaseEngine, string> = {
    [DatabaseEngine.Postgres]: 'PostgreSQL',
    [DatabaseEngine.Mysql]: 'MySQL',
    [DatabaseEngine.Mariadb]: 'MariaDB',
    [DatabaseEngine.Mongodb]: 'MongoDB',
    [DatabaseEngine.Redis]: 'Redis'
};

const ENGINES = Object.values(DatabaseEngine);

type Row =
    | { kind: 'app'; key: string; name: string; subtitle: string; date: string; repository: Repository }
    | { kind: 'database'; key: string; name: string; subtitle: string; date: string; database: Database }
    | { kind: 'install'; key: string; name: string; subtitle: string; date: string; install: TemplateInstall };

const buildRows = (repositories: Repository[], databases: Database[], installs: TemplateInstall[]): Row[] => [
    ...repositories.map((repository): Row => ({
        kind: 'app',
        key: `app-${repository.id}`,
        name: repository.name,
        subtitle: repository.owner !== null ? `${repository.owner} · ${repository.branch}` : repository.branch,
        date: repository.createdAt,
        repository
    })),
    ...databases.map((database): Row => ({
        kind: 'database',
        key: `database-${database.id}`,
        name: database.name,
        subtitle: database.version !== null ? `${database.engine} · ${database.version}` : database.engine,
        date: database.createdAt,
        database
    })),
    ...installs.map((install): Row => ({
        kind: 'install',
        key: `install-${install.id}`,
        name: install.name,
        subtitle: install.compose === null ? 'Template' : 'Docker Compose',
        date: install.createdAt,
        install
    }))
];

interface ApplicationsHeaderProps{
    canAddDatabase: boolean;
    onAddApplication: () => void;
    onAddCompose: () => void;
    onAddDatabase: () => void;
}

const ApplicationsHeader = ({ canAddDatabase, onAddApplication, onAddCompose, onAddDatabase }: ApplicationsHeaderProps) => (
    <PageHeader
        title='Applications'
        description='Repositories, databases, template installs and compose stacks for this organization.'
        actions={(
            <div className='flex flex-wrap gap-2'>
                <Button variant='secondary' isDisabled={!canAddDatabase} onPress={onAddDatabase}>
                    <DatabaseIcon aria-hidden='true' className='size-4' />
                    New database
                </Button>
                <Button variant='secondary' onPress={onAddCompose}>
                    <FileCode2 aria-hidden='true' className='size-4' />
                    Deploy compose
                </Button>
                <Button onPress={onAddApplication}>
                    New application
                    <ArrowRight aria-hidden='true' className='size-4' />
                </Button>
            </div>
        )}
    />
);

const primaryService = (install: TemplateInstall): TemplateInstallService | undefined =>
    install.services.find((service) => service.kind === 'app' && service.ports.length > 0)
        ?? install.services.find((service) => service.kind === 'app')
        ?? install.services[0];

const installPorts = (install: TemplateInstall): RepositoryPort[] =>
    (primaryService(install)?.ports ?? []).map((port) => ({
        internalPort: port.internalPort,
        externalPort: port.externalPort,
        protocol: port.protocol === 'udp' ? PortBindingProtocol.Udp : PortBindingProtocol.Tcp
    }));

interface RowActionHandlers{
    onNavigate: (path: string) => void;
    onDeleteApp: (repository: Repository) => void;
    onConnectionString: (database: Database) => void;
    onBackup: (database: Database) => void;
    onRestore: (database: Database) => void;
    onDeleteDatabase: (database: Database) => void;
    onUninstall: (install: TemplateInstall) => void;
    onOperateInstall: (install: TemplateInstall, operation: TemplateInstallOperation) => void;
    onRedeployInstall: (install: TemplateInstall) => void;
}

const rowActions = (row: Row, handlers: RowActionHandlers) => {
    if(row.kind === 'app'){
        const id = row.repository.id;
        return [
            <Dropdown.Item key='deployments' onAction={() => handlers.onNavigate(`/repositories/${id}/deployments`)}>
                Deployments
            </Dropdown.Item>,
            <Dropdown.Item key='logs' onAction={() => handlers.onNavigate(`/repositories/${id}/logs`)}>
                Logs
            </Dropdown.Item>,
            <Dropdown.Item key='shell' onAction={() => handlers.onNavigate(`/repositories/${id}/shell`)}>
                Shell
            </Dropdown.Item>,
            <Dropdown.Item key='env' onAction={() => handlers.onNavigate(`/repositories/${id}/environment-variables`)}>
                Environment variables
            </Dropdown.Item>,
            <Dropdown.Item key='settings' onAction={() => handlers.onNavigate(`/repositories/${id}/settings`)}>
                Settings
            </Dropdown.Item>,
            <Dropdown.Item key='delete' variant='danger' onAction={() => handlers.onDeleteApp(row.repository)}>
                Delete
            </Dropdown.Item>
        ];
    }

    if(row.kind === 'database'){
        return [
            <Dropdown.Item key='connection' onAction={() => handlers.onConnectionString(row.database)}>
                Connection string
            </Dropdown.Item>,
            <Dropdown.Item key='backup' onAction={() => handlers.onBackup(row.database)}>
                Backup now
            </Dropdown.Item>,
            <Dropdown.Item key='restore' isDisabled={row.database.backups.length === 0} onAction={() => handlers.onRestore(row.database)}>
                Restore
            </Dropdown.Item>,
            <Dropdown.Item key='delete' variant='danger' onAction={() => handlers.onDeleteDatabase(row.database)}>
                Delete
            </Dropdown.Item>
        ];
    }

    const install = row.install;
    const running = isInstallRunning(install.status);
    const busy = isInstallTransient(install.status);
    return [
        <Dropdown.Item key='services' onAction={() => handlers.onNavigate(`/installs/${install.id}/services`)}>
            Services
        </Dropdown.Item>,
        <Dropdown.Item key='logs' onAction={() => handlers.onNavigate(`/installs/${install.id}/logs`)}>
            Logs
        </Dropdown.Item>,
        <Dropdown.Item key='shell' onAction={() => handlers.onNavigate(`/installs/${install.id}/shell`)}>
            Shell
        </Dropdown.Item>,
        <Dropdown.Item key='env' onAction={() => handlers.onNavigate(`/installs/${install.id}/environment`)}>
            Environment variables
        </Dropdown.Item>,
        ...(install.compose === null ? [] : [
            <Dropdown.Item key='compose' onAction={() => handlers.onNavigate(`/installs/${install.id}/compose`)}>
                Compose
            </Dropdown.Item>
        ]),
        <Dropdown.Item key='start' isDisabled={running || busy} onAction={() => handlers.onOperateInstall(install, 'start')}>
            Start
        </Dropdown.Item>,
        <Dropdown.Item key='stop' isDisabled={!running || busy} onAction={() => handlers.onOperateInstall(install, 'stop')}>
            Stop
        </Dropdown.Item>,
        <Dropdown.Item key='restart' isDisabled={busy} onAction={() => handlers.onOperateInstall(install, 'restart')}>
            Restart
        </Dropdown.Item>,
        <Dropdown.Item key='redeploy' isDisabled={busy} onAction={() => handlers.onRedeployInstall(install)}>
            Redeploy
        </Dropdown.Item>,
        <Dropdown.Item key='uninstall' variant='danger' onAction={() => handlers.onUninstall(install)}>
            Uninstall
        </Dropdown.Item>
    ];
};

interface ApplicationsTableProps extends RowActionHandlers{
    rows: Row[];
}

const ApplicationsTable = ({ rows, ...handlers }: ApplicationsTableProps) => (
    <Table>
        <Table.ScrollContainer>
            <Table.Content aria-label='Applications'>
                <Table.Header>
                    <Table.Column isRowHeader>Name</Table.Column>
                    <Table.Column>Status</Table.Column>
                    <Table.Column>Address</Table.Column>
                    <Table.Column>Ports</Table.Column>
                    <Table.Column>Created</Table.Column>
                    <Table.Column><span className='sr-only'>Actions</span></Table.Column>
                </Table.Header>

                <Table.Body>
                    {rows.map((row) => {
                        return (
                            <Table.Row key={row.key}>
                                <Table.Cell>
                                    <div className='flex flex-col'>
                                        <span className='font-medium text-foreground'>{row.name}</span>
                                        <span className='text-[0.8125rem] text-muted'>{row.subtitle}</span>
                                    </div>
                                </Table.Cell>

                                <Table.Cell>
                                    {row.kind === 'app' && (
                                        <StatusDot
                                            color={containerStatusColor(row.repository.containerStatus)}
                                            label={containerStatusLabel(row.repository.containerStatus)}
                                            isTransient={isContainerTransient(row.repository.containerStatus)}
                                        />
                                    )}
                                    {row.kind === 'database' && (
                                        <StatusDot
                                            color={databaseStatusColor(row.database.status)}
                                            label={databaseStatusLabel(row.database.status)}
                                            isTransient={isDatabaseTransient(row.database.status)}
                                        />
                                    )}
                                    {row.kind === 'install' && (
                                        <StatusDot
                                            color={installStatusColor(row.install.status)}
                                            label={installStatusLabel(row.install.status)}
                                            isTransient={isInstallTransient(row.install.status)}
                                        />
                                    )}
                                </Table.Cell>

                                <Table.Cell>
                                    {row.kind === 'app' && <InternalAddress address={row.repository.address} />}
                                    {row.kind === 'install' && <InternalAddress address={primaryService(row.install)?.address ?? null} />}
                                    {row.kind === 'database' && <InternalAddress address={row.database.address} />}
                                </Table.Cell>

                                <Table.Cell>
                                    {row.kind === 'app' && <PublishedPorts ports={row.repository.ports} />}
                                    {row.kind === 'install' && <PublishedPorts ports={installPorts(row.install)} />}
                                    {row.kind === 'database' && <span className='text-[0.8125rem] text-muted'>—</span>}
                                </Table.Cell>

                                <Table.Cell>{formatDate(row.date)}</Table.Cell>

                                <Table.Cell>
                                    <div className='flex justify-end'>
                                        <Dropdown>
                                            <Dropdown.Trigger
                                                aria-label={`Actions for ${row.name}`}
                                                className='p-1.5 text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'
                                            >
                                                <MoreVertical aria-hidden='true' className='size-4' />
                                            </Dropdown.Trigger>

                                            <Dropdown.Popover placement='bottom end'>
                                                <Dropdown.Menu aria-label={`Actions for ${row.name}`}>
                                                    {rowActions(row, handlers)}
                                                </Dropdown.Menu>
                                            </Dropdown.Popover>
                                        </Dropdown>
                                    </div>
                                </Table.Cell>
                            </Table.Row>
                        );
                    })}
                </Table.Body>
            </Table.Content>
        </Table.ScrollContainer>
    </Table>
);

interface DeleteApplicationDialogProps{
    repository: Repository | null;
    onClose: () => void;
    onRemoved: () => void;
}

const DeleteApplicationDialog = ({ repository, onClose, onRemoved }: DeleteApplicationDialogProps) => (
    <DeleteConfirmDialog
        isOpen={repository !== null}
        title='Delete application'
        description={repository === null
            ? ''
            : `This permanently removes "${repository.name}" and its deployments. This action cannot be undone.`}
        entityId={repository?.id ?? null}
        remove={(id) => repositoryApi.remove({ path: { id } })}
        getErrorMessage={copy}
        onClose={onClose}
        onRemoved={onRemoved}
    />
);

interface CreateDatabaseDialogProps{
    projectId: number | null;
    isOpen: boolean;
    onClose: (isOpen: boolean) => void;
    onCreated: () => void;
}

const CreateDatabaseDialog = ({ projectId, isOpen, onClose, onCreated }: CreateDatabaseDialogProps) => {
    const [name, setName] = useState('');
    const [engine, setEngine] = useState<DatabaseEngine>(DatabaseEngine.Postgres);
    const [version, setVersion] = useState('');
    const create = useMutation((targetProjectId: number, body: CreateDatabaseInput) =>
        databaseApi.create({ path: { projectId: targetProjectId }, body }));

    const reset = () => {
        setName('');
        setEngine(DatabaseEngine.Postgres);
        setVersion('');
    };

    const handleClose = () => {
        if(create.loading) return;
        reset();
        onClose(false);
    };

    const handleCreate = async () => {
        if(projectId === null || name.trim() === '') return;

        const created = await create
            .run(projectId, { name: name.trim(), engine, version: version.trim() === '' ? undefined : version.trim() })
            .then(() => true, () => false);

        if(!created) return;
        reset();
        onClose(false);
        onCreated();
    };

    return (
        <Modal isOpen={isOpen} onOpenChange={(open) => { if(!open) handleClose(); }} title='New database'>
            <div className='flex flex-col gap-4'>
                <TextField value={name} onChange={setName} isDisabled={create.loading} validationBehavior='aria' fullWidth>
                    <Label>Name</Label>
                    <Input placeholder='my-database' autoComplete='off' />
                </TextField>

                <div className='flex flex-col gap-1.5'>
                    <Label>Engine</Label>
                    <Select
                        aria-label='Engine'
                        selectedKey={engine}
                        isDisabled={create.loading}
                        onSelectionChange={(key) => setEngine(key as DatabaseEngine)}
                    >
                        <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                        </Select.Trigger>

                        <Select.Popover>
                            <ListBox>
                                {ENGINES.map((value) => (
                                    <ListBoxItem key={value} id={value} textValue={ENGINE_LABEL[value]}>
                                        {ENGINE_LABEL[value]}
                                    </ListBoxItem>
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>
                </div>

                <TextField value={version} onChange={setVersion} isDisabled={create.loading} validationBehavior='aria' fullWidth>
                    <Label>Version (optional)</Label>
                    <Input placeholder='latest' autoComplete='off' />
                </TextField>

                {create.error !== undefined && <InlineError>{copy(create.error)}</InlineError>}

                <div className='flex justify-end gap-2'>
                    <Button variant='secondary' isDisabled={create.loading} onPress={handleClose}>Cancel</Button>
                    <Button isPending={create.loading} isDisabled={name.trim() === ''} onPress={() => { void handleCreate(); }}>
                        Create
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

interface ConnectionStringFieldProps{
    value: string;
}

const ConnectionStringField = ({ value }: ConnectionStringFieldProps) => {
    const [revealed, setRevealed] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        copyText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className='flex flex-col gap-1.5'>
            <span className='label-caps text-muted'>Connection string</span>

            <div className='flex items-center gap-2'>
                <code className='min-w-0 flex-1 truncate border border-border px-3 py-2 font-mono text-[0.8125rem] text-foreground'>
                    {revealed ? value : '•'.repeat(24)}
                </code>

                <Button variant='secondary' onPress={() => setRevealed((current) => !current)}>
                    {revealed ? <EyeOff aria-hidden='true' className='size-4' /> : <Eye aria-hidden='true' className='size-4' />}
                </Button>

                <Button variant='secondary' onPress={handleCopy}>
                    {copied ? <Check aria-hidden='true' className='size-4' /> : <Copy aria-hidden='true' className='size-4' />}
                </Button>
            </div>
        </div>
    );
};

interface ConnectionStringDialogProps{
    database: Database | null;
    onClose: () => void;
}

const ConnectionStringDialog = ({ database, onClose }: ConnectionStringDialogProps) => {
    const connectionString = useQuery((connectionStringId: number) => databaseApi.connectionString({ path: { id: connectionStringId } }), [database?.id], { enabled: database !== null });

    return (
        <Modal
            isOpen={database !== null}
            onOpenChange={(isOpen) => { if(!isOpen) onClose(); }}
            title={database === null ? 'Connection string' : `Connection string · ${database.name}`}
        >
            <div className='flex flex-col gap-4'>
                {connectionString.loading && <LinesSkeleton lines={2} />}

                {!connectionString.loading && connectionString.error !== undefined && (
                    <div className='flex flex-col gap-2'>
                        <InlineError>{copy(connectionString.error)}</InlineError>
                        <Button variant='secondary' onPress={connectionString.reload}>Try again</Button>
                    </div>
                )}

                {!connectionString.loading && connectionString.error === undefined && connectionString.data !== null && (
                    <ConnectionStringField value={connectionString.data.connectionString} />
                )}

                <div className='flex justify-end'>
                    <Button variant='secondary' onPress={onClose}>Close</Button>
                </div>
            </div>
        </Modal>
    );
};

interface RestoreDatabaseDialogProps{
    database: Database | null;
    onClose: () => void;
    onRestored: () => void;
}

const RestoreDatabaseDialog = ({ database, onClose, onRestored }: RestoreDatabaseDialogProps) => {
    const [backupId, setBackupId] = useState<string | null>(null);
    const restore = useMutation((id: number, backup: string) => databaseApi.restore({ path: { id }, body: { backupId: backup } }));

    const backups = database?.backups ?? [];

    const handleClose = () => {
        if(restore.loading) return;
        setBackupId(null);
        onClose();
    };

    const handleRestore = async () => {
        if(database === null || backupId === null) return;

        const restored = await restore.run(database.id, backupId).then(() => true, () => false);
        if(!restored) return;

        setBackupId(null);
        onClose();
        onRestored();
    };

    return (
        <Modal
            isOpen={database !== null}
            onOpenChange={(isOpen) => { if(!isOpen) handleClose(); }}
            title={database === null ? 'Restore database' : `Restore ${database.name}`}
        >
            <div className='flex flex-col gap-4'>
                {backups.length === 0 ? (
                    <p className='text-[0.875rem] text-muted'>This database has no backups yet.</p>
                ) : (
                    <div className='flex flex-col gap-1.5'>
                        <Label>Backup</Label>
                        <Select
                            aria-label='Backup'
                            selectedKey={backupId}
                            isDisabled={restore.loading}
                            onSelectionChange={(key) => setBackupId(String(key))}
                        >
                            <Select.Trigger>
                                <Select.Value>Select a backup</Select.Value>
                                <Select.Indicator />
                            </Select.Trigger>

                            <Select.Popover>
                                <ListBox>
                                    {backups.map((backup) => (
                                        <ListBoxItem key={backup.id} id={backup.id} textValue={formatDate(backup.createdAt)}>
                                            {formatDate(backup.createdAt)}
                                        </ListBoxItem>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    </div>
                )}

                {restore.error !== undefined && <InlineError>{copy(restore.error)}</InlineError>}

                <div className='flex justify-end gap-2'>
                    <Button variant='secondary' isDisabled={restore.loading} onPress={handleClose}>Cancel</Button>
                    <Button
                        isPending={restore.loading}
                        isDisabled={backupId === null}
                        onPress={() => { void handleRestore(); }}
                    >
                        Restore
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

interface DeleteDatabaseDialogProps{
    database: Database | null;
    onClose: () => void;
    onRemoved: () => void;
}

const DeleteDatabaseDialog = ({ database, onClose, onRemoved }: DeleteDatabaseDialogProps) => (
    <DeleteConfirmDialog
        isOpen={database !== null}
        title='Delete database'
        description={database === null
            ? ''
            : `This permanently removes "${database.name}" and its backups. This action cannot be undone.`}
        entityId={database?.id ?? null}
        remove={(id) => databaseApi.remove({ path: { id } })}
        getErrorMessage={copy}
        onClose={onClose}
        onRemoved={onRemoved}
    />
);

interface UninstallDialogProps{
    install: TemplateInstall | null;
    onClose: () => void;
    onRemoved: () => void;
}

const UninstallDialog = ({ install, onClose, onRemoved }: UninstallDialogProps) => (
    <DeleteConfirmDialog
        isOpen={install !== null}
        title='Uninstall template'
        description={install === null
            ? ''
            : `This permanently removes "${install.name}" and its services. This action cannot be undone.`}
        confirmLabel='Uninstall'
        entityId={install?.id ?? null}
        remove={(id) => templateInstallApi.remove({ path: { id } })}
        getErrorMessage={copy}
        onClose={onClose}
        onRemoved={onRemoved}
    />
);

const Applications = () => {
    const navigate = useNavigate();
    const organizationId = useCurrentOrganizationId();
    const projects = useResource(projectRoutes, {
        list: 'listByOrganization',
        request: organizationId === null ? null : { path: { orgId: organizationId } }
    });
    const [projectId, setProjectId] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const [params] = useSearchParams();

    useEffect(() => {
        if(projectId !== null) return;
        const list = projects.data ?? [];
        if(list.length === 0) return;
        const requested = Number(params.get('project'));
        const pick = list.find((project) => project.id === requested)
            ?? list.find((project) => project.isDefault)
            ?? list[0];
        if(pick !== undefined) setProjectId(pick.id);
    }, [projectId, projects.data, params]);

    const repositoriesQuery = useResource(repositoryRoutes, { list: 'mine' });
    const databasesQuery = useQuery((databasesProjectId: number) => databaseApi.listByProject({ path: { projectId: databasesProjectId } }), [projectId ?? undefined], { enabled: projectId !== null });
    const databases = usePolledQuery(databasesQuery, {
        while: (data) => data.some((database) => isDatabaseTransient(database.status)),
        everyMs: 5000
    });
    const installsQuery = useResource(templateInstallRoutes, {
        list: 'listByProject',
        request: projectId === null ? null : { path: { projectId } }
    });

    const [createDatabaseOpen, setCreateDatabaseOpen] = useState(false);
    const [deleteAppTarget, setDeleteAppTarget] = useState<Repository | null>(null);
    const [connectionTarget, setConnectionTarget] = useState<Database | null>(null);
    const [restoreTarget, setRestoreTarget] = useState<Database | null>(null);
    const [deleteDatabaseTarget, setDeleteDatabaseTarget] = useState<Database | null>(null);
    const [uninstallTarget, setUninstallTarget] = useState<TemplateInstall | null>(null);

    const backup = useMutation((id: number) => databaseApi.backup({ path: { id } }));

    const installs = installsQuery.data;
    const installsSettling = installs !== null && installs.some((install) => isInstallTransient(install.status));
    const refreshInstalls = installsQuery.refresh;
    useEffect(() => {
        if(!installsSettling) return;
        const timer = setInterval(refreshInstalls, 4000);
        return () => clearInterval(timer);
    }, [installsSettling, refreshInstalls]);

    const operateInstall = (install: TemplateInstall, operation: TemplateInstallOperation) => {
        void installsQuery.operate({ path: { id: install.id }, body: { operation } }).catch(() => undefined);
    };

    const redeployInstall = (install: TemplateInstall) => {
        void installsQuery.redeploy({ path: { id: install.id } }).catch(() => undefined);
    };

    const handleBackup = async (database: Database) => {
        await backup.run(database.id).then(() => databases.reload(), () => undefined);
    };

    if(organizationId === null || projects.loading || repositoriesQuery.loading){
        return <PageSkeleton actions={2} columns={5} />;
    }

    if(projects.error !== undefined){
        return (
            <CenterState className='h-full'>
                <ErrorState title='Could not load projects' description={copy(projects.error)} onRetry={projects.refresh} />
            </CenterState>
        );
    }

    if(repositoriesQuery.error !== undefined){
        return (
            <CenterState className='h-full'>
                <ErrorState
                    title='Could not load applications'
                    description={copy(repositoriesQuery.error)}
                    onRetry={repositoriesQuery.refresh}
                />
            </CenterState>
        );
    }

    const rows = buildRows(
        repositoriesQuery.data ?? [],
        projectId === null ? [] : databases.data ?? [],
        projectId === null ? [] : installsQuery.data ?? []
    );

    const query = search.trim().toLowerCase();
    const filtered = query === '' ? rows : rows.filter((row) => row.name.toLowerCase().includes(query));

    const scopedLoading = projectId !== null && (databases.loading || installsQuery.loading);
    const scopedError = databases.error ?? installsQuery.error;

    return (
        <PageBody width='wide' height='full'>
            <ApplicationsHeader
                canAddDatabase={projectId !== null}
                onAddApplication={() => navigate('/repositories/create')}
                onAddCompose={() => navigate('/compose/create')}
                onAddDatabase={() => setCreateDatabaseOpen(true)}
            />

            <div className='mt-6 flex flex-wrap items-center gap-3'>
                <div className='max-w-xs flex-1'>
                    <EntitySelect
                        items={projects.data ?? []}
                        getKey={(project) => project.id}
                        getLabel={(project) => project.name}
                        value={projectId}
                        onChange={(key) => setProjectId(Number(key))}
                        placeholder='Select a project'
                        ariaLabel='Project'
                    />
                </div>

                <TextField value={search} onChange={setSearch} validationBehavior='aria' className='max-w-xs flex-1'>
                    <Label className='sr-only'>Search</Label>
                    <Input placeholder='Search by name' autoComplete='off' />
                </TextField>
            </div>

            {backup.error !== undefined && <InlineError className='mt-4'>{copy(backup.error)}</InlineError>}
            {scopedError !== undefined && <InlineError className='mt-4'>{copy(scopedError)}</InlineError>}

            <div className='mt-6 flex flex-1 flex-col'>
                <ListPageShell
                    loading={scopedLoading}
                    skeleton={<TableSkeleton columns={5} />}
                    errorTitle='Could not load applications'
                    getErrorDescription={copy}
                    onRetry={databases.reload}
                    isEmpty={filtered.length === 0}
                    empty={{
                        icon: AppWindow,
                        title: query !== '' ? 'No matches' : 'No applications yet',
                        description: query !== ''
                            ? 'Try a different search term.'
                            : 'Create an application, or pick a project above to see its databases and template installs.',
                        action: query === '' ? (
                            <Button onPress={() => navigate('/repositories/create')}>
                                New application
                                <ArrowRight aria-hidden='true' className='size-4' />
                            </Button>
                        ) : undefined
                    }}
                >
                    <ApplicationsTable
                        rows={filtered}
                        onNavigate={navigate}
                        onDeleteApp={setDeleteAppTarget}
                        onConnectionString={setConnectionTarget}
                        onBackup={(database) => { void handleBackup(database); }}
                        onRestore={setRestoreTarget}
                        onDeleteDatabase={setDeleteDatabaseTarget}
                        onUninstall={setUninstallTarget}
                        onOperateInstall={operateInstall}
                        onRedeployInstall={redeployInstall}
                    />
                </ListPageShell>
            </div>

            <CreateDatabaseDialog
                projectId={projectId}
                isOpen={createDatabaseOpen}
                onClose={setCreateDatabaseOpen}
                onCreated={() => { setCreateDatabaseOpen(false); databases.reload(); }}
            />

            <DeleteApplicationDialog
                repository={deleteAppTarget}
                onClose={() => setDeleteAppTarget(null)}
                onRemoved={repositoriesQuery.refresh}
            />

            <ConnectionStringDialog
                key={connectionTarget?.id ?? 'connection'}
                database={connectionTarget}
                onClose={() => setConnectionTarget(null)}
            />

            <RestoreDatabaseDialog
                database={restoreTarget}
                onClose={() => setRestoreTarget(null)}
                onRestored={databases.reload}
            />

            <DeleteDatabaseDialog
                database={deleteDatabaseTarget}
                onClose={() => setDeleteDatabaseTarget(null)}
                onRemoved={databases.reload}
            />

            <UninstallDialog
                install={uninstallTarget}
                onClose={() => setUninstallTarget(null)}
                onRemoved={installsQuery.refresh}
            />
        </PageBody>
    );
};

export default Applications;
