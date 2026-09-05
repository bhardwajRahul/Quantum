import { Button } from '@heroui/react';
import typia from 'typia';
import Modal from '@/shared/components/Modal';
import Form from '@/shared/components/forms/Form';
import Field from '@/shared/components/forms/Field';
import { useForm } from '@/shared/hooks/forms/use-form';
import { projectApi } from '@/modules/project/api/api';
import { projectErrorMessages } from '@/modules/project/utils/error-messages';
import type { Project } from '@quantum/contracts/modules/project/domain';
import type { UpdateProjectInput } from '@quantum/contracts/modules/project/http';

interface RenameProjectDialogProps{
    project: Project | null;
    onClose: () => void;
    onRenamed: () => void;
}

const RenameProjectDialog = ({ project, onClose, onRenamed }: RenameProjectDialogProps) => {
    const form = useForm<UpdateProjectInput>({
        validate: typia.createValidate<UpdateProjectInput>(),
        submitErrorMessages: projectErrorMessages,
        initialValues: { name: project?.name ?? '' },
        onSubmit: async (values) => {
            if(project === null) return;
            await projectApi.update({ path: { id: project.id }, body: { name: values.name?.trim() } });
            onRenamed();
            onClose();
        }
    });

    const name = form.values.name ?? '';

    return (
        <Modal
            isOpen={project !== null}
            onOpenChange={(isOpen) => { if(!isOpen && !form.submitting) onClose(); }}
            title='Rename project'
        >
            <Form form={form} className='flex flex-col gap-4'>
                <Field form={form} name='name' label='Name' autoComplete='off' />

                <div className='flex justify-end gap-2'>
                    <Button variant='secondary' isDisabled={form.submitting} onPress={onClose}>Cancel</Button>
                    <Button type='submit' isPending={form.submitting} isDisabled={name.trim() === ''}>Save</Button>
                </div>
            </Form>
        </Modal>
    );
};

export default RenameProjectDialog;
