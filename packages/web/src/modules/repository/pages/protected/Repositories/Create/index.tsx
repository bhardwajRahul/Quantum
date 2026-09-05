import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Chip, ComboBox, Input, Label, ListBox, ListBoxItem, Select } from '@heroui/react';
import { FolderGit2, Search } from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import ErrorState from '@/shared/components/ErrorState';
import EmptyState from '@/shared/components/EmptyState';
import CenterState from '@/shared/components/CenterState';
import Form from '@/shared/components/forms/Form';
import Field from '@/shared/components/forms/Field';
import EntitySelect from '@/shared/components/EntitySelect';
import ConnectGithubButton from '@/modules/github/components/ConnectGithubButton';
import { useForm } from '@/shared/hooks/forms/use-form';
import { useQuery } from '@/shared/hooks/api/use-query';
import { useResource } from '@/shared/hooks/api/use-resource';
import { githubApi } from '@/modules/github/api/api';
import { repositoryApi } from '@/modules/repository/api/api';
import { projectRoutes } from '@quantum/contracts/modules/project/routes';
import { useCurrentOrganizationId } from '@/modules/organization/hooks/use-current-organization-id';
import { githubErrorMessages } from '@/modules/github/utils/error-messages';
import { repositoryErrorMessages } from '@/modules/repository/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import {
    CREATE_REPOSITORY_INITIAL_VALUES,
    FRAMEWORK_OPTIONS,
    RUNTIME_OPTIONS,
    toCreateRepositoryInput,
    validateCreateRepositoryForm
} from '@/modules/repository/utils/create-repository-form';
import type { IValidation } from 'typia';
import type { CreateRepositoryFormValues } from '@/modules/repository/utils/create-repository-form';
import type { GithubRepository, RepositoryDetection } from '@quantum/contracts/modules/github/domain';
import type { Project } from '@quantum/contracts/modules/project/domain';

const githubCopy = errorCopy(githubErrorMessages);
const repositoryCopy = errorCopy(repositoryErrorMessages);

const initialValuesFor = (
    repository: GithubRepository,
    detection: RepositoryDetection | null
): CreateRepositoryFormValues => ({
    ...CREATE_REPOSITORY_INITIAL_VALUES,
    name: repository.name,
    url: repository.htmlUrl,
    alias: repository.name,
    branch: repository.defaultBranch,
    framework: detection?.framework ?? '',
    runtime: detection?.runtime ?? '',
    installCommand: detection?.installCommand ?? '',
    buildCommand: detection?.buildCommand ?? '',
    startCommand: detection?.startCommand ?? '',
    outputDirectory: detection?.outputDirectory ?? '',
    port: detection?.port !== undefined ? String(detection.port) : ''
});

const validateFormValues = (input: unknown): IValidation<CreateRepositoryFormValues> => {
    const result = validateCreateRepositoryForm(input);
    if(!result.success) return result;
    return { success: true, data: input as CreateRepositoryFormValues };
};

const ConnectGithubPrompt = () => (
    <EmptyState
        icon={FolderGit2}
        title='Connect GitHub'
        description='Connect your GitHub account to import and deploy a repository.'
    >
        <ConnectGithubButton />
    </EmptyState>
);

interface RepositoryPickerProps{
    repositories: GithubRepository[];
    onSelect: (repository: GithubRepository) => void;
}

/**
 * Filtering is done here rather than handed to the ComboBox's `defaultFilter`, which
 * would mean reaching for `useFilter` out of a transitive dependency of the design
 * system. The list is already in memory, so matching on `fullName` is enough.
 */
const RepositoryPicker = ({ repositories, onSelect }: RepositoryPickerProps) => {
    const [query, setQuery] = useState('');

    if(repositories.length === 0){
        return (
            <CenterState className='h-full'>
                <EmptyState
                    icon={FolderGit2}
                    title='No repositories found'
                    description='Push a repository to your GitHub account to import it here.'
                />
            </CenterState>
        );
    }

    const needle = query.trim().toLowerCase();
    const visible = needle === ''
        ? repositories
        : repositories.filter((repository) => repository.fullName.toLowerCase().includes(needle));

    return (
        <div className='flex w-full max-w-xl flex-col gap-1.5'>
            <Label id='repository-picker-label'>Repository</Label>

            <ComboBox
                aria-labelledby='repository-picker-label'
                inputValue={query}
                onInputChange={setQuery}
                onSelectionChange={(key) => {
                    const repository = repositories.find((candidate) => candidate.fullName === key);
                    if(repository !== undefined) onSelect(repository);
                }}
                allowsEmptyCollection
                fullWidth
            >
                <ComboBox.InputGroup>
                    <Input placeholder='Search your repositories…' autoComplete='off' />
                    <ComboBox.Trigger />
                </ComboBox.InputGroup>

                <ComboBox.Popover>
                    <ListBox
                        aria-labelledby='repository-picker-label'
                        renderEmptyState={() => (
                            <EmptyState icon={Search} title='No matches' description='Try a different search term.' compact />
                        )}
                    >
                        {visible.map((repository) => (
                            <ListBoxItem
                                key={repository.fullName}
                                id={repository.fullName}
                                textValue={repository.fullName}
                            >
                                <div className='flex w-full items-center justify-between gap-3'>
                                    <span className='truncate'>{repository.fullName}</span>
                                    <Chip size='sm' variant='soft' color={repository.private ? 'default' : 'success'}>
                                        {repository.private ? 'Private' : 'Public'}
                                    </Chip>
                                </div>
                            </ListBoxItem>
                        ))}
                    </ListBox>
                </ComboBox.Popover>
            </ComboBox>

            <p className='text-[0.8125rem] text-muted'>
                {repositories.length} {repositories.length === 1 ? 'repository' : 'repositories'} available. Type to narrow them down.
            </p>
        </div>
    );
};

interface RepositoryConfigFieldsProps{
    repository: GithubRepository;
    detection: RepositoryDetection | null;
    projects: Project[];
    onBack: () => void;
}

const RepositoryConfigFields = ({ repository, detection, projects, onBack }: RepositoryConfigFieldsProps) => {
    const navigate = useNavigate();

    const form = useForm<CreateRepositoryFormValues>({
        validate: validateFormValues,
        submitErrorMessages: repositoryErrorMessages,
        initialValues: initialValuesFor(repository, detection),
        onSubmit: async (values) => {
            const created = await repositoryApi.create({ body: toCreateRepositoryInput(values) });
            navigate(`/repositories/${created.id}/deployments`);
        }
    });

    return (
        <Card>
            <Card.Header>
                <div className='flex items-center justify-between gap-3'>
                    <div>
                        <Card.Title>{repository.fullName}</Card.Title>
                        <Card.Description>Configure how this repository is built and run.</Card.Description>
                    </div>
                    <Button variant='secondary' size='sm' onPress={onBack}>Change repository</Button>
                </div>
            </Card.Header>

            <Card.Content>
                <Form form={form} className='flex flex-col gap-4'>
                    <Field form={form} name='alias' label='Alias' placeholder='my-repository' />

                    <Field form={form} name='branch'>
                        {(binding) => (
                            <div className='flex flex-col gap-1.5'>
                                <Label>Branch</Label>
                                <Select
                                    aria-label='Branch'
                                    selectedKey={(binding.value as string) === '' ? null : (binding.value as string)}
                                    onSelectionChange={(key) => binding.onChange(String(key))}
                                >
                                    <Select.Trigger>
                                        <Select.Value />
                                        <Select.Indicator />
                                    </Select.Trigger>

                                    <Select.Popover>
                                        <ListBox>
                                            {repository.branches.map((branch) => (
                                                <ListBoxItem key={branch} id={branch} textValue={branch}>
                                                    {branch}
                                                </ListBoxItem>
                                            ))}
                                        </ListBox>
                                    </Select.Popover>
                                </Select>
                            </div>
                        )}
                    </Field>

                    <Field form={form} name='projectId'>
                        {(binding) => (
                            <div className='flex flex-col gap-1.5'>
                                <Label>Project</Label>
                                <EntitySelect
                                    items={projects}
                                    getKey={(project) => project.id}
                                    getLabel={(project) => project.name}
                                    value={(binding.value as number) === 0 ? null : (binding.value as number)}
                                    onChange={(key) => binding.onChange(Number(key))}
                                    placeholder='Select a project'
                                    ariaLabel='Project'
                                />
                            </div>
                        )}
                    </Field>

                    <div className='grid gap-4 sm:grid-cols-2'>
                        <Field form={form} name='framework'>
                            {(binding) => (
                                <div className='flex flex-col gap-1.5'>
                                    <Label>Framework</Label>
                                    <Select
                                        aria-label='Framework'
                                        placeholder='Select a framework'
                                        selectedKey={(binding.value as string) === '' ? null : (binding.value as string)}
                                        onSelectionChange={(key) => binding.onChange(String(key))}
                                    >
                                        <Select.Trigger>
                                            <Select.Value />
                                            <Select.Indicator />
                                        </Select.Trigger>

                                        <Select.Popover>
                                            <ListBox>
                                                {FRAMEWORK_OPTIONS.map((framework) => (
                                                    <ListBoxItem key={framework} id={framework} textValue={framework}>
                                                        {framework}
                                                    </ListBoxItem>
                                                ))}
                                            </ListBox>
                                        </Select.Popover>
                                    </Select>
                                </div>
                            )}
                        </Field>

                        <Field form={form} name='runtime'>
                            {(binding) => (
                                <div className='flex flex-col gap-1.5'>
                                    <Label>Runtime</Label>
                                    <Select
                                        aria-label='Runtime'
                                        placeholder='Select a runtime'
                                        selectedKey={(binding.value as string) === '' ? null : (binding.value as string)}
                                        onSelectionChange={(key) => binding.onChange(String(key))}
                                    >
                                        <Select.Trigger>
                                            <Select.Value />
                                            <Select.Indicator />
                                        </Select.Trigger>

                                        <Select.Popover>
                                            <ListBox>
                                                {RUNTIME_OPTIONS.map((runtime) => (
                                                    <ListBoxItem key={runtime.value} id={runtime.value} textValue={runtime.label}>
                                                        {runtime.label}
                                                    </ListBoxItem>
                                                ))}
                                            </ListBox>
                                        </Select.Popover>
                                    </Select>
                                </div>
                            )}
                        </Field>
                    </div>

                    <Field form={form} name='runtimeVersion' label='Runtime version' placeholder='20' />

                    <Field form={form} name='installCommand' label='Install command' placeholder='npm install' />
                    <Field form={form} name='buildCommand' label='Build command' placeholder='npm run build' />
                    <Field form={form} name='startCommand' label='Start command' placeholder='npm start' />

                    <div className='grid gap-4 sm:grid-cols-2'>
                        <Field form={form} name='outputDirectory' label='Output directory' placeholder='dist' />
                        <Field form={form} name='port' label='Port' type='number' placeholder='3000' />
                    </div>

                    <div>
                        <Button type='submit' isPending={form.submitting} isDisabled={!form.isValid}>
                            Create repository
                        </Button>
                    </div>
                </Form>
            </Card.Content>
        </Card>
    );
};

interface RepositoryConfigFormProps{
    repository: GithubRepository;
    onBack: () => void;
}

const RepositoryConfigForm = ({ repository, onBack }: RepositoryConfigFormProps) => {
    const organizationId = useCurrentOrganizationId();
    const projects = useResource(projectRoutes, {
        list: 'listByOrganization',
        request: organizationId === null ? null : { path: { orgId: organizationId } }
    });
    const detection = useQuery((owner: string, repo: string) => githubApi.detect({ path: { owner, repo } }), [repository.owner, repository.name]);

    if(projects.loading || detection.loading){
        return <CenterState className='h-full'><EmptyState title='Preparing repository setup' compact /></CenterState>;
    }

    if(projects.error !== undefined){
        return (
            <CenterState className='h-full'>
                <ErrorState
                    title='Could not load projects'
                    description={repositoryCopy(projects.error)}
                    onRetry={projects.refresh}
                />
            </CenterState>
        );
    }

    return (
        <RepositoryConfigFields
            key={repository.fullName}
            repository={repository}
            detection={detection.data}
            projects={projects.data ?? []}
            onBack={onBack}
        />
    );
};

const RepositoryCreateFlow = () => {
    const repositories = useQuery(githubApi.repositories);
    const [selected, setSelected] = useState<GithubRepository | null>(null);

    if(repositories.loading){
        return <CenterState className='h-full'><EmptyState title='Loading GitHub repositories' compact /></CenterState>;
    }

    if(repositories.error !== undefined){
        return (
            <CenterState className='h-full'>
                <ErrorState
                    title='Could not load GitHub repositories'
                    description={githubCopy(repositories.error)}
                    onRetry={repositories.reload}
                />
            </CenterState>
        );
    }

    if(selected === null){
        return <RepositoryPicker repositories={repositories.data ?? []} onSelect={setSelected} />;
    }

    return <RepositoryConfigForm repository={selected} onBack={() => setSelected(null)} />;
};

const CreateRepository = () => {
    const account = useQuery(githubApi.account);

    return (
        <PageBody height='full'>
            <h1 className='text-lg font-medium text-foreground'>New repository</h1>
            <p className='mt-1.5 text-sm text-muted'>
                Import a GitHub repository and configure how it is built and run.
            </p>

            <div className='mt-6 flex flex-1 flex-col'>
                {account.loading ? (
                    <CenterState><EmptyState title='Checking GitHub connection' compact /></CenterState>
                ) : account.error !== undefined ? (
                    <CenterState><ConnectGithubPrompt /></CenterState>
                ) : (
                    <RepositoryCreateFlow />
                )}
            </div>
        </PageBody>
    );
};

export default CreateRepository;
