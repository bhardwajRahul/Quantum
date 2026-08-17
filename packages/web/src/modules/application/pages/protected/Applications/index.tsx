import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Chip, Input, Label, ListBox, ListBoxItem, Select, Table, TextField } from '@heroui/react';
import {
    AppWindow,
    Check,
    Copy,
    Database as DatabaseIcon,
    Eye,
    EyeOff,
    MoreVertical,
    Package,
    Plus
} from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import LoadingState from '@/shared/components/LoadingState';
import ErrorState from '@/shared/components/ErrorState';
import EmptyState from '@/shared/components/EmptyState';
import ConfirmDialog from '@/shared/components/ConfirmDialog';
import Modal from '@/shared/components/Modal';
import InlineError from '@/shared/components/InlineError';
import { Dropdown } from '@heroui/react';
import ProjectSelect from '@/modules/application/components/ProjectSelect';
import { useQuery } from '@/shared/hooks/api/use-query';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { usePolledQuery } from '@/shared/hooks/api/use-polled-query';
import { repositoryApi } from '@/modules/repository/api/api';
import { databaseApi } from '@/modules/database/api/api';
import { templateInstallApi } from '@/modules/template/api/api';
import { projectApi } from '@/modules/application/api/projects';
import { useCurrentOrganizationId } from '@/modules/organization/hooks/use-current-organization-id';
import { databaseStatusColor, databaseStatusLabel, isDatabaseTransient } from '@/modules/application/utils/status';
import { formatDate } from '@/modules/application/utils/format-date';
import { copyText } from '@/modules/application/utils/clipboard';
import { applicationErrorMessages } from '@/modules/application/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import { DatabaseEngine } from '@quantum/contracts/modules/database/domain';
import type { Database } from '@quantum/contracts/modules/database/domain';
import type { CreateDatabaseInput } from '@quantum/contracts/modules/database/http';
import type { Repository } from '@quantum/contracts/modules/repository/domain';
import type { TemplateInstall } from '@quantum/contracts/modules/template/domain';

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
        subtitle: `Template · v${install.templateVersion}`,
        date: install.createdAt,
        install
    }))
];

interface ApplicationsHeaderProps{
    canAddDatabase: boolean;
    onAddApplication: () => void;
    onAddDatabase: () => void;
}

const ApplicationsHeader = ({ canAddDatabase, onAddApplication, onAddDatabase }: ApplicationsHeaderProps) => (
    <div className='flex items-center justify-between gap-4'>
        <div>
            <h1 className='text-lg font-medium text-foreground'>Applications</h1>
            <p className='mt-1.5 text-sm text-muted'>Repositories, databases, and template installs for this organization.</p>
        </div>

        <div className='flex gap-2'>
            <Button variant='secondary' isDisabled={!canAddDatabase} onPress={onAddDatabase}>
                <DatabaseIcon aria-hidden='true' className='size-4' />
                New database
            </Button>
            <Button onPress={onAddApplication}>
                <Plus aria-hidden='true' className='size-4' />
                New application
            </Button>
        </div>
    </div>
);

interface RowActionHandlers{
    onNavigate: (path: string) => void;
    onDeleteApp: (repository: Repository) => void;
    onConnectionString: (database: Database) => void;
    onBackup: (database: Database) => void;
    onRestore: (database: Database) => void;
    onDeleteDatabase: (database: Database) => void;
    onUninstall: (install: TemplateInstall) => void;
}

const rowActions = (row: Row, handlers: RowActionHandlers) => {
    if(row.kind === 'app'){
        const id = row.repository.id;
        return [
            <Dropdown.Item key='deployments' onAction={() => handlers.onNavigate(`/repositories/${id}/deployments`)}>
                Deployments
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

    return [
        <Dropdown.Item key='uninstall' variant='danger' onAction={() => handlers.onUninstall(row.install)}>
            Uninstall
        </Dropdown.Item>
    ];
};

const ROW_ICON = { app: AppWindow, database: DatabaseIcon, install: Package } as const;

interface ApplicationsTableProps extends RowActionHandlers{
    rows: Row[];
}

const ApplicationsTable = ({ rows, ...handlers }: ApplicationsTableProps) => (
    <Table aria-label='Applications'>
        <Table.Header>
            <Table.Column isRowHeader>Name</Table.Column>
            <Table.Column>Status</Table.Column>
            <Table.Column>Created</Table.Column>
            <Table.Column><span className='sr-only'>Actions</span></Table.Column>
        </Table.Header>

        <Table.Body>
            {rows.map((row) => {
                const RowIcon = ROW_ICON[row.kind];

                return (
                    <Table.Row key={row.key}>
                        <Table.Cell>
                            <div className='flex items-center gap-3'>
                                <span className='flex size-8 shrink-0 items-center justify-center rounded-md bg-foreground/[0.06]'>
                                    <RowIcon aria-hidden='true' className='size-4 text-muted' />
                                </span>
                                <div className='flex flex-col'>
                                    <span className='font-medium text-foreground'>{row.name}</span>
                                    <span className='text-[0.8125rem] text-muted'>{row.subtitle}</span>
                                </div>
                            </div>
                        </Table.Cell>

                        <Table.Cell>
                            {row.kind === 'app' && (
                                <Chip size='sm' variant='soft' color={row.repository.containerId !== null ? 'success' : 'default'}>
                                    {row.repository.containerId !== null ? 'Running' : 'Stopped'}
                                </Chip>
                            )}
                            {row.kind === 'database' && (
                                <Chip size='sm' variant='soft' color={databaseStatusColor(row.database.status)}>
                                    {databaseStatusLabel(row.database.status)}
                                </Chip>
                            )}
                            {row.kind === 'install' && <Chip size='sm' variant='soft' color='success'>Installed</Chip>}
                        </Table.Cell>

                        <Table.Cell>{formatDate(row.date)}</Table.Cell>

                        <Table.Cell>
                            <div className='flex justify-end'>
                                <Dropdown>
                                    <Dropdown.Trigger
                                        aria-label={`Actions for ${row.name}`}
                                        className='rounded-md p-1.5 text-muted transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'
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
    </Table>
);

interface DeleteApplicationDialogProps{
    repository: Repository | null;
    onClose: () => void;
    onRemoved: () => void;
}

const DeleteApplicationDialog = ({ repository, onClose, onRemoved }: DeleteApplicationDialogProps) => {
    const remove = useMutation((id: number) => repositoryApi.remove(id));

    const handleRemove = async () => {
        if(repository === null) return;

        const removed = await remove.run(repository.id).then(() => true, () => false);
        if(!removed) return;

        onClose();
        onRemoved();
    };

    return (
        <ConfirmDialog
            isOpen={repository !== null}
            onOpenChange={(isOpen) => { if(!isOpen) onClose(); }}
            title='Delete application'
            description={repository === null
                ? ''
                : `This permanently removes "${repository.name}" and its deployments. This action cannot be undone.`}
            confirmLabel='Delete'
            isPending={remove.loading}
            error={copy(remove.error)}
            onConfirm={() => { void handleRemove(); }}
        />
    );
};

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
        databaseApi.create(targetProjectId, body));

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
            <span className='text-[0.8125rem] text-muted'>Connection string</span>

            <div className='flex items-center gap-2'>
                <code className='min-w-0 flex-1 truncate rounded-md bg-surface px-3 py-2 text-[0.8125rem] text-foreground'>
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
    const connectionString = useQuery(databaseApi.connectionString, [database?.id], { enabled: database !== null });

    return (
        <Modal
            isOpen={database !== null}
            onOpenChange={(isOpen) => { if(!isOpen) onClose(); }}
            title={database === null ? 'Connection string' : `Connection string · ${database.name}`}
        >
            <div className='flex flex-col gap-4'>
                {connectionString.loading && <LoadingState title='Loading connection string' compact />}

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
    const restore = useMutation((id: number, backup: string) => databaseApi.restore(id, { backupId: backup }));

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

const DeleteDatabaseDialog = ({ database, onClose, onRemoved }: DeleteDatabaseDialogProps) => {
    const remove = useMutation((id: number) => databaseApi.remove(id));

    const handleRemove = async () => {
        if(database === null) return;

        const removed = await remove.run(database.id).then(() => true, () => false);
        if(!removed) return;

        onClose();
        onRemoved();
    };

    return (
        <ConfirmDialog
            isOpen={database !== null}
            onOpenChange={(isOpen) => { if(!isOpen) onClose(); }}
            title='Delete database'
            description={database === null
                ? ''
                : `This permanently removes "${database.name}" and its backups. This action cannot be undone.`}
            confirmLabel='Delete'
            isPending={remove.loading}
            error={copy(remove.error)}
            onConfirm={() => { void handleRemove(); }}
        />
    );
};

interface UninstallDialogProps{
    install: TemplateInstall | null;
    onClose: () => void;
    onRemoved: () => void;
}

const UninstallDialog = ({ install, onClose, onRemoved }: UninstallDialogProps) => {
    const remove = useMutation((id: number) => templateInstallApi.remove(id));

    const handleRemove = async () => {
        if(install === null) return;

        const removed = await remove.run(install.id).then(() => true, () => false);
        if(!removed) return;

        onClose();
        onRemoved();
    };

    return (
        <ConfirmDialog
            isOpen={install !== null}
            onOpenChange={(isOpen) => { if(!isOpen) onClose(); }}
            title='Uninstall template'
            description={install === null
                ? ''
                : `This permanently removes "${install.name}" and its services. This action cannot be undone.`}
            confirmLabel='Uninstall'
            isPending={remove.loading}
            error={copy(remove.error)}
            onConfirm={() => { void handleRemove(); }}
        />
    );
};

const Applications = () => {
    const navigate = useNavigate();
    const organizationId = useCurrentOrganizationId();
    const projects = useQuery(projectApi.listByOrganization, [organizationId ?? undefined]);
    const [projectId, setProjectId] = useState<number | null>(null);
    const [search, setSearch] = useState('');

    const repositoriesQuery = useQuery(repositoryApi.mine);
    const databasesQuery = useQuery(databaseApi.listByProject, [projectId ?? undefined], { enabled: projectId !== null });
    const databases = usePolledQuery(databasesQuery, {
        while: (data) => data.some((database) => isDatabaseTransient(database.status)),
        everyMs: 5000
    });
    const installsQuery = useQuery(templateInstallApi.listByProject, [projectId ?? undefined], { enabled: projectId !== null });

    const [createDatabaseOpen, setCreateDatabaseOpen] = useState(false);
    const [deleteAppTarget, setDeleteAppTarget] = useState<Repository | null>(null);
    const [connectionTarget, setConnectionTarget] = useState<Database | null>(null);
    const [restoreTarget, setRestoreTarget] = useState<Database | null>(null);
    const [deleteDatabaseTarget, setDeleteDatabaseTarget] = useState<Database | null>(null);
    const [uninstallTarget, setUninstallTarget] = useState<TemplateInstall | null>(null);

    const backup = useMutation((id: number) => databaseApi.backup(id));

    const handleBackup = async (database: Database) => {
        await backup.run(database.id).then(() => databases.reload(), () => undefined);
    };

    if(organizationId === null || projects.loading || repositoriesQuery.loading){
        return <LoadingState title='Loading applications' compact />;
    }

    if(projects.error !== undefined){
        return <ErrorState title='Could not load projects' description={copy(projects.error)} onRetry={projects.reload} />;
    }

    if(repositoriesQuery.error !== undefined){
        return (
            <ErrorState
                title='Could not load applications'
                description={copy(repositoriesQuery.error)}
                onRetry={repositoriesQuery.reload}
            />
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
        <PageBody width='wide'>
            <ApplicationsHeader
                canAddDatabase={projectId !== null}
                onAddApplication={() => navigate('/repositories/create')}
                onAddDatabase={() => setCreateDatabaseOpen(true)}
            />

            <div className='mt-6 flex flex-wrap items-center gap-3'>
                <div className='max-w-xs flex-1'>
                    <ProjectSelect projects={projects.data ?? []} value={projectId} onChange={setProjectId} />
                </div>

                <TextField value={search} onChange={setSearch} validationBehavior='aria' className='max-w-xs flex-1'>
                    <Label className='sr-only'>Search</Label>
                    <Input placeholder='Search by name' autoComplete='off' />
                </TextField>
            </div>

            {backup.error !== undefined && <InlineError className='mt-4'>{copy(backup.error)}</InlineError>}
            {scopedError !== undefined && <InlineError className='mt-4'>{copy(scopedError)}</InlineError>}

            <div className='mt-6'>
                {scopedLoading ? (
                    <LoadingState title='Loading applications' compact />
                ) : filtered.length === 0 ? (
                    <EmptyState
                        icon={AppWindow}
                        title={query !== '' ? 'No matches' : 'No applications yet'}
                        description={query !== ''
                            ? 'Try a different search term.'
                            : 'Create an application, or pick a project above to see its databases and template installs.'}
                    >
                        {query === '' && (
                            <Button onPress={() => navigate('/repositories/create')}>
                                <Plus aria-hidden='true' className='size-4' />
                                New application
                            </Button>
                        )}
                    </EmptyState>
                ) : (
                    <ApplicationsTable
                        rows={filtered}
                        onNavigate={navigate}
                        onDeleteApp={setDeleteAppTarget}
                        onConnectionString={setConnectionTarget}
                        onBackup={(database) => { void handleBackup(database); }}
                        onRestore={setRestoreTarget}
                        onDeleteDatabase={setDeleteDatabaseTarget}
                        onUninstall={setUninstallTarget}
                    />
                )}
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
                onRemoved={repositoriesQuery.reload}
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
                onRemoved={installsQuery.reload}
            />
        </PageBody>
    );
};

export default Applications;
