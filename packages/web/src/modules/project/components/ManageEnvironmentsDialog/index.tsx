import { Button, Label, ListBox, ListBoxItem, Select } from '@heroui/react';
import { Trash2 } from 'lucide-react';
import typia from 'typia';
import Modal from '@/shared/components/Modal';
import Form from '@/shared/components/forms/Form';
import Field from '@/shared/components/forms/Field';
import EmptyState from '@/shared/components/EmptyState';
import InlineError from '@/shared/components/InlineError';
import { useForm } from '@/shared/hooks/forms/use-form';
import { useResource } from '@/shared/hooks/api/use-resource';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { environmentApi } from '@/modules/project/api/api';
import { environmentRoutes } from '@quantum/contracts/modules/project/routes';
import { projectErrorMessages } from '@/modules/project/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import { EnvironmentType } from '@quantum/contracts/modules/project/domain';
import type { Project } from '@quantum/contracts/modules/project/domain';
import type { CreateEnvironmentInput } from '@quantum/contracts/modules/project/http';

const copy = errorCopy(projectErrorMessages);

const ENVIRONMENT_TYPES: Array<{ value: EnvironmentType; label: string }> = [
    { value: EnvironmentType.Production, label: 'Production' },
    { value: EnvironmentType.Staging, label: 'Staging' },
    { value: EnvironmentType.Preview, label: 'Preview' }
];

const labelOf = (type: EnvironmentType): string =>
    ENVIRONMENT_TYPES.find((option) => option.value === type)?.label ?? type;

interface CreateEnvironmentFormProps{
    projectId: number;
    onCreated: () => void;
}

const CreateEnvironmentForm = ({ projectId, onCreated }: CreateEnvironmentFormProps) => {
    const form = useForm<CreateEnvironmentInput>({
        validate: typia.createValidate<CreateEnvironmentInput>(),
        submitErrorMessages: projectErrorMessages,
        initialValues: { name: '', type: EnvironmentType.Production },
        onSubmit: async (values) => {
            await environmentApi.create({ path: { projectId }, body: { ...values, name: values.name.trim() } });
            form.reset();
            onCreated();
        }
    });

    const type = form.field('type');

    return (
        <Form form={form} className='flex flex-col gap-4'>
            <Field form={form} name='name' label='Name' placeholder='preview' autoComplete='off' />

            <div className='flex flex-col gap-1.5'>
                <Label>Type</Label>
                <Select
                    aria-label='Environment type'
                    selectedKey={type.value}
                    isDisabled={form.submitting}
                    onSelectionChange={(key) => type.onChange(key as EnvironmentType)}
                >
                    <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                    </Select.Trigger>

                    <Select.Popover>
                        <ListBox>
                            {ENVIRONMENT_TYPES.map((option) => (
                                <ListBoxItem key={option.value} id={option.value} textValue={option.label}>
                                    {option.label}
                                </ListBoxItem>
                            ))}
                        </ListBox>
                    </Select.Popover>
                </Select>
            </div>

            <div>
                <Button type='submit' isPending={form.submitting} isDisabled={!form.isValid}>
                    Add environment
                </Button>
            </div>
        </Form>
    );
};

interface ManageEnvironmentsDialogProps{
    project: Project | null;
    onClose: () => void;
}

const ManageEnvironmentsDialog = ({ project, onClose }: ManageEnvironmentsDialogProps) => {
    const environments = useResource(environmentRoutes, {
        list: 'list',
        request: project === null ? null : { path: { projectId: project.id } }
    });
    const remove = useMutation((environmentId: number) => environmentApi.remove({ path: { id: environmentId } }));

    const handleRemove = (environmentId: number) => {
        void remove.run(environmentId).then(() => environments.refresh(), () => undefined);
    };

    return (
        <Modal
            isOpen={project !== null}
            onOpenChange={(isOpen) => { if(!isOpen) onClose(); }}
            title={project === null ? 'Environments' : `Environments · ${project.name}`}
        >
            <div className='flex flex-col gap-6'>
                <p className='text-[0.875rem] text-muted'>
                    Environments isolate deployments (production, staging, preview) within this project.
                </p>

                {environments.loading && <EmptyState title='Loading environments' compact />}

                {!environments.loading && environments.error !== undefined && (
                    <div className='flex flex-col gap-2'>
                        <InlineError>{copy(environments.error)}</InlineError>
                        <Button variant='secondary' onPress={environments.refresh}>Try again</Button>
                    </div>
                )}

                {!environments.loading && environments.error === undefined && (
                    <ul className='flex flex-col divide-y divide-border'>
                        {(environments.data ?? []).map((environment) => (
                            <li key={environment.id} className='flex items-center justify-between gap-4 py-3'>
                                <div className='min-w-0'>
                                    <p className='truncate text-[0.875rem] text-foreground'>{environment.name}</p>
                                    <p className='text-[0.8125rem] text-muted'>{labelOf(environment.type)}</p>
                                </div>

                                <Button
                                    variant='secondary'
                                    isDisabled={remove.loading}
                                    onPress={() => handleRemove(environment.id)}
                                >
                                    <Trash2 aria-hidden='true' className='size-4' />
                                    Delete
                                </Button>
                            </li>
                        ))}

                        {(environments.data ?? []).length === 0 && (
                            <li className='py-3 text-[0.875rem] text-muted'>No environments yet.</li>
                        )}
                    </ul>
                )}

                {remove.error !== undefined && <InlineError>{copy(remove.error)}</InlineError>}

                {project !== null && <CreateEnvironmentForm projectId={project.id} onCreated={environments.refresh} />}
            </div>
        </Modal>
    );
};

export default ManageEnvironmentsDialog;
