import { useState } from 'react';
import { Button, Label } from '@heroui/react';
import typia from 'typia';
import Modal from '@/shared/components/Modal';
import Form from '@/shared/components/forms/Form';
import Field from '@/shared/components/forms/Field';
import RepositorySelect from '@/modules/domain/components/RepositorySelect';
import { useForm } from '@/shared/hooks/forms/use-form';
import { domainApi } from '@/modules/domain/api/api';
import { domainErrorMessages } from '@/modules/domain/utils/error-messages';
import type { Repository } from '@quantum/contracts/modules/repository/domain';
import type { CreateDomainInput } from '@quantum/contracts/modules/domain/http';

interface CreateDomainDialogProps{
    repositories: Repository[];
    defaultRepositoryId: number | null;
    onClose: () => void;
    onCreated: (repositoryId: number) => void;
}

const CreateDomainDialog = ({
    repositories,
    defaultRepositoryId,
    onClose,
    onCreated
}: CreateDomainDialogProps) => {
    const [repositoryId, setRepositoryId] = useState<number | null>(defaultRepositoryId);

    const form = useForm<CreateDomainInput>({
        validate: typia.createValidate<CreateDomainInput>(),
        initialValues: { host: '' },
        submitErrorMessages: domainErrorMessages,
        onSubmit: async (values) => {
            if(repositoryId === null) return;
            await domainApi.create({ path: { repositoryId }, body: { host: values.host.trim() } });
            onCreated(repositoryId);
            onClose();
        }
    });

    return (
        <Modal isOpen onOpenChange={(isOpen) => { if(!isOpen && !form.submitting) onClose(); }} title='Add domain'>
            <Form form={form} className='flex flex-col gap-4'>
                <div className='flex flex-col gap-1.5'>
                    <Label>Repository</Label>
                    <RepositorySelect
                        repositories={repositories}
                        value={repositoryId}
                        onChange={setRepositoryId}
                        isDisabled={form.submitting}
                    />
                </div>

                <Field form={form} name='host' label='Host' placeholder='app.example.com' autoComplete='off' />

                <div className='flex justify-end gap-2'>
                    <Button variant='secondary' isDisabled={form.submitting} onPress={onClose}>Cancel</Button>
                    <Button type='submit' isPending={form.submitting} isDisabled={repositoryId === null}>
                        Add domain
                    </Button>
                </div>
            </Form>
        </Modal>
    );
};

export default CreateDomainDialog;
