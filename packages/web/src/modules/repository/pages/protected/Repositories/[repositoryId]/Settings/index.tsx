import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Label, ListBox, ListBoxItem, Select } from '@heroui/react';
import { Trash2 } from 'lucide-react';
import typia from 'typia';
import PageBody from '@/shared/components/layout/PageBody';
import LoadingState from '@/shared/components/LoadingState';
import ErrorState from '@/shared/components/ErrorState';
import ConfirmDialog from '@/shared/components/ConfirmDialog';
import Form from '@/shared/components/forms/Form';
import Field from '@/shared/components/forms/Field';
import { useForm } from '@/shared/hooks/forms/use-form';
import { useQuery } from '@/shared/hooks/api/use-query';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { repositoryApi } from '@/modules/repository/api/api';
import { repositoryErrorMessages } from '@/modules/repository/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import { BuildStrategy } from '@quantum/contracts/modules/repository/domain';
import type { IValidation } from 'typia';
import type { Repository } from '@quantum/contracts/modules/repository/domain';
import type { UpdateRepositoryInput } from '@quantum/contracts/modules/repository/http';

const copy = errorCopy(repositoryErrorMessages);

const BUILD_STRATEGIES: BuildStrategy[] = [
    BuildStrategy.Auto,
    BuildStrategy.Dockerfile,
    BuildStrategy.PrebuiltImage,
    BuildStrategy.Exec
];

const BUILD_STRATEGY_LABELS: Record<BuildStrategy, string> = {
    [BuildStrategy.Auto]: 'Auto',
    [BuildStrategy.Dockerfile]: 'Dockerfile',
    [BuildStrategy.PrebuiltImage]: 'Prebuilt image',
    [BuildStrategy.Exec]: 'Exec'
};

interface RepositorySettingsFormValues{
    alias: string;
    branch: string;
    buildCommand: string;
    installCommand: string;
    startCommand: string;
    rootDirectory: string;
    outputDirectory: string;
    framework: string;
    runtime: string;
    runtimeVersion: string;
    port: string;
    buildStrategy: BuildStrategy;
    dockerfilePath: string;
    image: string;
}

const toRepositorySettingsFormValues = (repository: Repository): RepositorySettingsFormValues => ({
    alias: repository.alias,
    branch: repository.branch,
    buildCommand: repository.buildCommand,
    installCommand: repository.installCommand,
    startCommand: repository.startCommand,
    rootDirectory: repository.rootDirectory,
    outputDirectory: repository.outputDirectory ?? '',
    framework: repository.framework ?? '',
    runtime: repository.runtime ?? '',
    runtimeVersion: repository.runtimeVersion ?? '',
    port: repository.port === null ? '' : String(repository.port),
    buildStrategy: repository.buildStrategy,
    dockerfilePath: repository.dockerfilePath ?? '',
    image: repository.image ?? ''
});

const optional = (value: string): string | undefined => {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
};

const toUpdateRepositoryInput = (values: RepositorySettingsFormValues): UpdateRepositoryInput => {
    const alias = optional(values.alias);
    const branch = optional(values.branch);
    const buildCommand = optional(values.buildCommand);
    const installCommand = optional(values.installCommand);
    const startCommand = optional(values.startCommand);
    const rootDirectory = optional(values.rootDirectory);
    const outputDirectory = optional(values.outputDirectory);
    const framework = optional(values.framework);
    const runtime = optional(values.runtime);
    const runtimeVersion = optional(values.runtimeVersion);
    const port = optional(values.port);
    const dockerfilePath = optional(values.dockerfilePath);
    const image = optional(values.image);

    return {
        ...(alias !== undefined ? { alias } : {}),
        ...(branch !== undefined ? { branch } : {}),
        ...(buildCommand !== undefined ? { buildCommand } : {}),
        ...(installCommand !== undefined ? { installCommand } : {}),
        ...(startCommand !== undefined ? { startCommand } : {}),
        ...(rootDirectory !== undefined ? { rootDirectory } : {}),
        ...(outputDirectory !== undefined ? { outputDirectory } : {}),
        ...(framework !== undefined ? { framework } : {}),
        ...(runtime !== undefined ? { runtime } : {}),
        ...(runtimeVersion !== undefined ? { runtimeVersion } : {}),
        ...(port !== undefined ? { port: Number(port) } : {}),
        buildStrategy: values.buildStrategy,
        ...(dockerfilePath !== undefined ? { dockerfilePath } : {}),
        ...(image !== undefined ? { image } : {})
    };
};

const validateInput = typia.createValidate<UpdateRepositoryInput>();

const validateRepositorySettingsForm = (input: unknown): IValidation<RepositorySettingsFormValues> => {
    const values = input as RepositorySettingsFormValues;
    const result = validateInput(toUpdateRepositoryInput(values));
    if(!result.success) return result;
    return { success: true, data: values };
};

interface RepositorySettingsFormProps{
    repository: Repository;
    onSaved: () => void;
}

const RepositorySettingsForm = ({ repository, onSaved }: RepositorySettingsFormProps) => {
    const form = useForm<RepositorySettingsFormValues>({
        validate: validateRepositorySettingsForm,
        submitErrorMessages: repositoryErrorMessages,
        initialValues: toRepositorySettingsFormValues(repository),
        onSubmit: async (values) => {
            await repositoryApi.update(repository.id, toUpdateRepositoryInput(values));
            onSaved();
        }
    });

    return (
        <Card>
            <Card.Header>
                <Card.Title>Configuration</Card.Title>
                <Card.Description>Update how this repository is built and run.</Card.Description>
            </Card.Header>

            <Card.Content>
                <Form form={form} className='flex flex-col gap-4'>
                    <Field form={form} name='alias' label='Alias' placeholder='my-repository' />
                    <Field form={form} name='branch' label='Branch' placeholder='main' />

                    <div className='grid gap-4 sm:grid-cols-2'>
                        <Field form={form} name='framework' label='Framework' placeholder='Next.js' />
                        <Field form={form} name='runtime' label='Runtime' placeholder='node' />
                    </div>

                    <div className='grid gap-4 sm:grid-cols-2'>
                        <Field form={form} name='runtimeVersion' label='Runtime version' placeholder='20' />
                        <Field form={form} name='port' label='Port' type='number' placeholder='3000' />
                    </div>

                    <Field form={form} name='installCommand' label='Install command' placeholder='npm install' />
                    <Field form={form} name='buildCommand' label='Build command' placeholder='npm run build' />
                    <Field form={form} name='startCommand' label='Start command' placeholder='npm start' />

                    <div className='grid gap-4 sm:grid-cols-2'>
                        <Field form={form} name='rootDirectory' label='Root directory' placeholder='/' />
                        <Field form={form} name='outputDirectory' label='Output directory' placeholder='dist' />
                    </div>

                    <Field form={form} name='buildStrategy'>
                        {(binding) => (
                            <div className='flex flex-col gap-1.5'>
                                <Label>Build strategy</Label>
                                <Select
                                    aria-label='Build strategy'
                                    selectedKey={binding.value as BuildStrategy}
                                    isDisabled={form.submitting}
                                    onSelectionChange={(key) => binding.onChange(key as BuildStrategy)}
                                >
                                    <Select.Trigger>
                                        <Select.Value />
                                        <Select.Indicator />
                                    </Select.Trigger>

                                    <Select.Popover>
                                        <ListBox>
                                            {BUILD_STRATEGIES.map((strategy) => (
                                                <ListBoxItem key={strategy} id={strategy} textValue={BUILD_STRATEGY_LABELS[strategy]}>
                                                    {BUILD_STRATEGY_LABELS[strategy]}
                                                </ListBoxItem>
                                            ))}
                                        </ListBox>
                                    </Select.Popover>
                                </Select>
                            </div>
                        )}
                    </Field>

                    {form.values.buildStrategy === BuildStrategy.Dockerfile && (
                        <Field form={form} name='dockerfilePath' label='Dockerfile path' placeholder='Dockerfile' />
                    )}

                    {form.values.buildStrategy === BuildStrategy.PrebuiltImage && (
                        <Field form={form} name='image' label='Image' placeholder='registry.example.com/app:latest' />
                    )}

                    <div>
                        <Button type='submit' isPending={form.submitting} isDisabled={!form.isValid}>
                            Save
                        </Button>
                    </div>
                </Form>
            </Card.Content>
        </Card>
    );
};

const RepositoryDetails = ({ repository }: { repository: Repository }) => (
    <Card>
        <Card.Header>
            <Card.Title>Details</Card.Title>
            <Card.Description>Reference information for this repository.</Card.Description>
        </Card.Header>

        <Card.Content>
            <dl className='flex flex-col divide-y divide-border'>
                {[
                    ['Name', repository.name],
                    ['URL', repository.url],
                    ['Owner', repository.owner ?? '—'],
                    ['Created', new Date(repository.createdAt).toLocaleDateString()]
                ].map(([label, value]) => (
                    <div key={label} className='flex items-center justify-between gap-4 py-3'>
                        <dt className='text-[0.8125rem] text-muted'>{label}</dt>
                        <dd className='text-[0.875rem] text-foreground'>{value}</dd>
                    </div>
                ))}
            </dl>
        </Card.Content>
    </Card>
);

interface DeleteRepositoryDialogProps{
    repository: Repository;
    isOpen: boolean;
    onClose: (isOpen: boolean) => void;
}

const DeleteRepositoryDialog = ({ repository, isOpen, onClose }: DeleteRepositoryDialogProps) => {
    const navigate = useNavigate();
    const remove = useMutation((repositoryId: number) => repositoryApi.remove(repositoryId));

    const handleDelete = async () => {
        const deleted = await remove.run(repository.id).then(() => true, () => false);
        if(!deleted) return;

        navigate('/applications');
    };

    return (
        <ConfirmDialog
            isOpen={isOpen}
            onOpenChange={onClose}
            title='Delete repository'
            description={`This permanently removes ${repository.alias} and its deployments. This action cannot be undone.`}
            confirmLabel='Delete'
            isPending={remove.loading}
            error={copy(remove.error)}
            onConfirm={() => { void handleDelete(); }}
        />
    );
};

const DangerZone = ({ repository }: { repository: Repository }) => {
    const [deleteOpen, setDeleteOpen] = useState(false);

    return (
        <Card>
            <Card.Header>
                <Card.Title className='text-[var(--danger)]'>Danger zone</Card.Title>
                <Card.Description>
                    Deleting a repository permanently removes it and all of its deployments. This action cannot be undone.
                </Card.Description>
            </Card.Header>

            <Card.Content>
                <Button variant='danger' onPress={() => setDeleteOpen(true)}>
                    <Trash2 aria-hidden='true' className='size-4' />
                    Delete repository
                </Button>
            </Card.Content>

            <DeleteRepositoryDialog repository={repository} isOpen={deleteOpen} onClose={setDeleteOpen} />
        </Card>
    );
};

const RepositorySettings = () => {
    const { repositoryId } = useParams<{ repositoryId: string }>();
    const id = repositoryId !== undefined ? Number(repositoryId) : undefined;

    const repository = useQuery(repositoryApi.get, [id]);

    if(repository.loading) return <LoadingState title='Loading repository' compact />;
    if(repository.error !== undefined){
        return (
            <ErrorState
                title='Could not load repository'
                description={copy(repository.error)}
                onRetry={repository.reload}
            />
        );
    }
    if(repository.data === null) return null;

    return (
        <PageBody>
            <h1 className='text-lg font-medium text-foreground'>Settings</h1>
            <p className='mt-1.5 text-sm text-muted'>
                Update how {repository.data.alias} is built and run, review its details, or delete it.
            </p>

            <div className='mt-6 flex flex-col gap-6'>
                <RepositorySettingsForm
                    key={repository.data.id}
                    repository={repository.data}
                    onSaved={repository.reload}
                />
                <RepositoryDetails repository={repository.data} />
                <DangerZone repository={repository.data} />
            </div>
        </PageBody>
    );
};

export default RepositorySettings;
