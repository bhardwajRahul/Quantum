import { useState } from 'react';
import { Label } from '@heroui/react';
import typia from 'typia';
import SingleFieldDialog from '@/shared/components/SingleFieldDialog';
import EntitySelect from '@/shared/components/EntitySelect';
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
        <SingleFieldDialog
            isOpen
            onOpenChange={(isOpen) => { if(!isOpen && !form.submitting) onClose(); }}
            title='Add domain'
            form={form}
            fieldName='host'
            fieldLabel='Host'
            fieldPlaceholder='app.example.com'
            extra={(
                <div className='flex flex-col gap-1.5'>
                    <Label>Repository</Label>
                    <EntitySelect
                        items={repositories}
                        getKey={(repository) => repository.id}
                        getLabel={(repository) => repository.name !== '' ? repository.name : repository.alias}
                        value={repositoryId}
                        onChange={(key) => setRepositoryId(Number(key))}
                        placeholder='Select a repository'
                        ariaLabel='Repository'
                        isDisabled={form.submitting}
                    />
                </div>
            )}
            extraPosition='before'
            submitLabel='Add domain'
            submitDisabled={repositoryId === null}
            onCancel={onClose}
        />
    );
};

export default CreateDomainDialog;
