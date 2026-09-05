import { Button } from '@heroui/react';
import typia from 'typia';
import Modal from '@/shared/components/Modal';
import Form from '@/shared/components/forms/Form';
import Field from '@/shared/components/forms/Field';
import { useForm } from '@/shared/hooks/forms/use-form';
import { codespaceApi } from '@/modules/codespace/api/api';
import { codespaceErrorMessages } from '@/modules/codespace/utils/error-messages';
import type { CreateCodespaceInput } from '@quantum/contracts/modules/codespace/http';

interface CreateCodespaceDialogProps{
    projectId: number;
    isOpen: boolean;
    onClose: (isOpen: boolean) => void;
    onCreated: () => void;
}

const CreateCodespaceDialog = ({ projectId, isOpen, onClose, onCreated }: CreateCodespaceDialogProps) => {
    const form = useForm<CreateCodespaceInput>({
        validate: typia.createValidate<CreateCodespaceInput>(),
        submitErrorMessages: codespaceErrorMessages,
        initialValues: { name: '' },
        onSubmit: async (values) => {
            await codespaceApi.create({ path: { projectId }, body: { name: values.name.trim() } });
            onCreated();
            onClose(false);
        }
    });

    return (
        <Modal isOpen={isOpen} onOpenChange={(open) => { if(!open && !form.submitting) onClose(false); }} title='New codespace'>
            <Form form={form} className='flex flex-col gap-4'>
                <p className='text-[0.875rem] text-muted'>Spin up a cloud dev environment for this project.</p>

                <Field form={form} name='name' label='Name' placeholder='my-codespace' autoComplete='off' />

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

export default CreateCodespaceDialog;
