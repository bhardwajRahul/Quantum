import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from '@heroui/react';
import { Trash2 } from 'lucide-react';
import typia from 'typia';
import PageBody from '@/shared/components/layout/PageBody';
import EmptyState from '@/shared/components/EmptyState';
import DeleteConfirmDialog from '@/shared/components/DeleteConfirmDialog';
import Form from '@/shared/components/forms/Form';
import Field from '@/shared/components/forms/Field';
import { useForm } from '@/shared/hooks/forms/use-form';
import { useTenancy } from '@/modules/organization/hooks/use-tenancy';
import { organizationApi } from '@/modules/organization/api/api';
import { tenancyErrorMessages } from '@/modules/organization/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import { useTenantStore } from '@/shared/store/tenant';
import type { Organization } from '@quantum/contracts/modules/organization/domain';
import type { UpdateOrganizationInput } from '@quantum/contracts/modules/organization/http';

const copy = errorCopy(tenancyErrorMessages);

interface RenameOrganizationFormProps{
    organization: Organization;
    onSaved: () => void;
}

const RenameOrganizationForm = ({ organization, onSaved }: RenameOrganizationFormProps) => {
    const form = useForm<UpdateOrganizationInput>({
        validate: typia.createValidate<UpdateOrganizationInput>(),
        submitErrorMessages: tenancyErrorMessages,
        initialValues: { name: organization.name },
        onSubmit: async (values) => {
            await organizationApi.update({ path: { id: organization.id }, body: values });
            onSaved();
        }
    });

    return (
        <Card>
            <Card.Header>
                <Card.Title>Rename organization</Card.Title>
                <Card.Description>Change the display name of this organization.</Card.Description>
            </Card.Header>

            <Card.Content>
                <Form form={form} className='flex flex-col gap-4'>
                    <Field form={form} name='name' label='Name' placeholder='my-organization' />

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

const OrganizationDetails = ({ organization }: { organization: Organization }) => (
    <Card>
        <Card.Header>
            <Card.Title>Details</Card.Title>
            <Card.Description>Reference information for this organization.</Card.Description>
        </Card.Header>

        <Card.Content>
            <dl className='flex flex-col divide-y divide-border'>
                {[
                    ['Name', organization.name],
                    ['Slug', organization.slug],
                    ['Type', organization.isPersonal ? 'Personal' : 'Team'],
                    ['Created', new Date(organization.createdAt).toLocaleDateString()]
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

interface DeleteOrganizationDialogProps{
    organization: Organization;
    isOpen: boolean;
    onClose: (isOpen: boolean) => void;
    onRemoved: () => void;
}

const DeleteOrganizationDialog = ({ organization, isOpen, onClose, onRemoved }: DeleteOrganizationDialogProps) => (
    <DeleteConfirmDialog
        isOpen={isOpen}
        title='Delete organization'
        description={`This permanently removes ${organization.name} and everything inside it. This action cannot be undone.`}
        entityId={organization.id}
        remove={(organizationId) => organizationApi.remove({ path: { id: organizationId } })}
        getErrorMessage={copy}
        onClose={() => onClose(false)}
        onRemoved={onRemoved}
    />
);

const DangerZone = ({ organization }: { organization: Organization }) => {
    const clearTenant = useTenantStore((state) => state.clear);
    const navigate = useNavigate();
    const [deleteOpen, setDeleteOpen] = useState(false);

    return (
        <Card>
            <Card.Header>
                <Card.Title className='text-[var(--danger)]'>Danger zone</Card.Title>
                <Card.Description>
                    Deleting an organization permanently removes it and all of its projects,
                    environments and resources. This action cannot be undone.
                </Card.Description>
            </Card.Header>

            <Card.Content>
                <Button variant='danger' onPress={() => setDeleteOpen(true)}>
                    <Trash2 aria-hidden='true' className='size-4' />
                    Delete organization
                </Button>
            </Card.Content>

            <DeleteOrganizationDialog
                organization={organization}
                isOpen={deleteOpen}
                onClose={setDeleteOpen}
                onRemoved={() => { clearTenant(); navigate('/dashboard'); }}
            />
        </Card>
    );
};

const OrganizationSettings = () => {
    const { current, reload } = useTenancy();

    if(current === null) return <EmptyState title='Loading organization' compact />;

    return (
        <PageBody>
            <h1 className='text-lg font-medium text-foreground'>Organization</h1>
            <p className='mt-1.5 text-sm text-muted'>
                Rename the selected organization, review its details, or delete it.
            </p>

            <div className='mt-6 flex flex-col gap-6'>
                <RenameOrganizationForm key={current.id} organization={current} onSaved={reload} />
                <OrganizationDetails organization={current} />
                <DangerZone organization={current} />
            </div>
        </PageBody>
    );
};

export default OrganizationSettings;
