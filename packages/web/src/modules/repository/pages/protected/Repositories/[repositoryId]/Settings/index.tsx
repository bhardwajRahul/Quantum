import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Label, ListBox, ListBoxItem, Select } from '@heroui/react';
import { ArrowRight } from 'lucide-react';
import typia from 'typia';
import EmptyState from '@/shared/components/EmptyState';
import ErrorState from '@/shared/components/ErrorState';
import SettingsSection from '@/shared/components/SettingsSection';
import DeleteConfirmDialog from '@/shared/components/DeleteConfirmDialog';
import Form from '@/shared/components/forms/Form';
import Field from '@/shared/components/forms/Field';
import PersistentVolumes from '@/modules/repository/components/PersistentVolumes';
import { useForm } from '@/shared/hooks/forms/use-form';
import { useQuery } from '@/shared/hooks/api/use-query';
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
            await repositoryApi.update({ path: { id: repository.id }, body: toUpdateRepositoryInput(values) });
            onSaved();
        }
    });

    return (
        <Form form={form} className='flex flex-col'>
            <SettingsSection title='General' description='How this repository is named and which branch is deployed.'>
                <div className='grid gap-5 sm:grid-cols-2'>
                    <Field form={form} name='alias' label='Alias' placeholder='my-repository' />
                    <Field form={form} name='branch' label='Branch' placeholder='main' />
                </div>
            </SettingsSection>

            <SettingsSection title='Build' description='The runtime it runs on and the commands that build and start it.'>
                <div className='grid gap-5 sm:grid-cols-2'>
                    <Field form={form} name='framework' label='Framework' placeholder='Next.js' />
                    <Field form={form} name='runtime' label='Runtime' placeholder='node' />
                    <Field form={form} name='runtimeVersion' label='Runtime version' placeholder='20' />
                    <Field form={form} name='port' label='Port' type='number' placeholder='3000' />
                </div>

                <div className='grid gap-5 sm:grid-cols-3'>
                    <Field form={form} name='installCommand' label='Install command' placeholder='npm install' />
                    <Field form={form} name='buildCommand' label='Build command' placeholder='npm run build' />
                    <Field form={form} name='startCommand' label='Start command' placeholder='npm start' />
                </div>

                <div className='grid gap-5 sm:grid-cols-2'>
                    <Field form={form} name='rootDirectory' label='Root directory' placeholder='/' />
                    <Field form={form} name='outputDirectory' label='Output directory' placeholder='dist' />
                </div>
            </SettingsSection>

            <SettingsSection title='Build strategy' description='Let Quantum detect the build, or point it at a Dockerfile or a prebuilt image.'>
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
            </SettingsSection>

            <div className='border-t border-border py-6'>
                <Button type='submit' isPending={form.submitting} isDisabled={!form.isValid}>
                    Save
                    <ArrowRight aria-hidden='true' className='size-4' />
                </Button>
            </div>
        </Form>
    );
};

const RepositoryDetails = ({ repository }: { repository: Repository }) => (
    <SettingsSection title='Details' description='Reference information for this repository.'>
        <dl className='flex flex-col'>
            {[
                ['Name', repository.name],
                ['URL', repository.url],
                ['Owner', repository.owner ?? '—'],
                ['Created', new Date(repository.createdAt).toLocaleDateString()]
            ].map(([label, value]) => (
                <div key={label} className='flex items-center justify-between gap-4 border-b border-separator py-3 first:pt-0 last:border-0'>
                    <dt className='label-caps shrink-0 text-muted'>{label}</dt>
                    <dd className='min-w-0 truncate font-mono text-[0.8125rem] text-foreground'>{value}</dd>
                </div>
            ))}
        </dl>
    </SettingsSection>
);

interface DeleteRepositoryDialogProps{
    repository: Repository;
    isOpen: boolean;
    onClose: (isOpen: boolean) => void;
    onRemoved: () => void;
}

const DeleteRepositoryDialog = ({ repository, isOpen, onClose, onRemoved }: DeleteRepositoryDialogProps) => (
    <DeleteConfirmDialog
        isOpen={isOpen}
        title='Delete repository'
        description={`This permanently removes ${repository.alias} and its deployments. This action cannot be undone.`}
        entityId={repository.id}
        remove={(repositoryId) => repositoryApi.remove({ path: { id: repositoryId } })}
        getErrorMessage={copy}
        onClose={() => onClose(false)}
        onRemoved={onRemoved}
    />
);

const DangerZone = ({ repository }: { repository: Repository }) => {
    const navigate = useNavigate();
    const [deleteOpen, setDeleteOpen] = useState(false);

    return (
        <SettingsSection
            title='Delete repository'
            description='Deleting a repository permanently removes it and all of its deployments. This action cannot be undone.'
        >
            <div>
                <Button variant='danger' onPress={() => setDeleteOpen(true)}>Delete repository</Button>
            </div>

            <DeleteRepositoryDialog
                repository={repository}
                isOpen={deleteOpen}
                onClose={setDeleteOpen}
                onRemoved={() => navigate('/applications')}
            />
        </SettingsSection>
    );
};

const RepositorySettings = () => {
    const { repositoryId } = useParams<{ repositoryId: string }>();
    const id = repositoryId !== undefined ? Number(repositoryId) : undefined;

    const repository = useQuery((repositoryId: number) => repositoryApi.get({ path: { id: repositoryId } }), [id]);

    if(repository.loading) return <EmptyState title='Loading repository' compact />;
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
        <div>
            <div className='flex flex-wrap items-end justify-between gap-4'>
                <div>
                    <h2 className='text-[0.9375rem] font-medium text-foreground'>Settings</h2>
                    <p className='mt-1 text-[0.8125rem] text-muted'>
                        Update how {repository.data.alias} is built and run, review its details, or delete it.
                    </p>
                </div>
            </div>

            <div className='mt-6 flex flex-col'>
                <RepositorySettingsForm
                    key={repository.data.id}
                    repository={repository.data}
                    onSaved={repository.reload}
                />
                <PersistentVolumes key={`volumes-${repository.data.id}`} repository={repository.data} onSaved={repository.reload} />
                <RepositoryDetails repository={repository.data} />
                <DangerZone repository={repository.data} />
            </div>
        </div>
    );
};

export default RepositorySettings;
