import { Button } from '@heroui/react';
import typia from 'typia';
import Modal from '@/shared/components/Modal';
import Form from '@/shared/components/forms/Form';
import Field from '@/shared/components/forms/Field';
import { useForm } from '@/shared/hooks/forms/use-form';
import { projectApi } from '@/modules/project/api/api';
import { projectErrorMessages } from '@/modules/project/utils/error-messages';
import type { CreateProjectInput } from '@quantum/contracts/modules/project/http';

interface CreateProjectDialogProps{
    organizationId: number;
    isOpen: boolean;
    onClose: (isOpen: boolean) => void;
    onCreated: () => void;
}

const CreateProjectDialog = ({ organizationId, isOpen, onClose, onCreated }: CreateProjectDialogProps) => {
    const form = useForm<CreateProjectInput>({
        validate: typia.createValidate<CreateProjectInput>(),
        submitErrorMessages: projectErrorMessages,
        initialValues: { name: '' },
        onSubmit: async (values) => {
            await projectApi.create(organizationId, { name: values.name.trim() });
            onCreated();
            onClose(false);
        }
    });

    return (
        <Modal isOpen={isOpen} onOpenChange={(open) => { if(!open && !form.submitting) onClose(false); }} title='New project'>
            <Form form={form} className='flex flex-col gap-4'>
                <p className='text-[0.875rem] text-muted'>Create a project to group related deployments.</p>

                <Field form={form} name='name' label='Name' placeholder='my-awesome-project' autoComplete='off' />

                <div className='flex justify-end gap-2'>
                    <Button variant='secondary' isDisabled={form.submitting} onPress={() => onClose(false)}>
                        Cancel
                    </Button>
                    <Button type='submit' isPending={form.submitting} isDisabled={!form.isValid}>Create</Button>
                </div>
            </Form>
        </Modal>
    );
};

export default CreateProjectDialog;
