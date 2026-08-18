import { useState } from 'react';
import {
    Button,
    Input,
    ListBox,
    ListBoxItem,
    Popover,
    Separator,
    Skeleton,
    TextField,
    AutocompleteFilter,
    useFilter
} from '@heroui/react';
import { ChevronDown, Plus } from 'lucide-react';
import Modal from '@/shared/components/Modal';
import CreateOrganizationForm from '@/modules/organization/components/CreateOrganizationForm';
import { useTenancy } from '@/modules/organization/hooks/use-tenancy';
import { useTenantStore } from '@/shared/store/tenant';
import type { Organization } from '@quantum/contracts/modules/organization/domain';

interface TriggerProps{
    name: string | undefined;
    loading: boolean;
}

const Trigger = ({ name, loading }: TriggerProps) => (
    <Button
        variant='ghost'
        size='sm'
        aria-haspopup='dialog'
        className='-ml-2 h-8 gap-1.5 rounded-lg px-2 text-[0.875rem] font-medium'
    >
        {loading
            ? <Skeleton className='h-3.5 w-16 rounded' />
            : <span className='max-w-28 truncate capitalize sm:max-w-40'>{name ?? 'No organization'}</span>}
        <ChevronDown aria-hidden='true' className='size-4 shrink-0 text-muted' />
    </Button>
);

interface OrganizationRowProps{
    organization: Organization;
}

const OrganizationRow = ({ organization }: OrganizationRowProps) => (
    <ListBoxItem
        id={organization.id}
        textValue={organization.name}
        className='rounded-full'
    >
        <span className='flex-1 truncate capitalize'>{organization.name}</span>
        <ListBoxItem.Indicator />
    </ListBoxItem>
);

const OrganizationSwitcher = () => {
    const { organizations, current, loading, reload } = useTenancy();
    const setOrganizationId = useTenantStore((state) => state.setOrganizationId);
    const { contains } = useFilter({ sensitivity: 'base' });

    const [open, setOpen] = useState(false);
    const [creating, setCreating] = useState(false);

    if(!loading && organizations.length === 0) return null;

    return (
        <>
            <Popover.Root isOpen={open} onOpenChange={setOpen}>
                <Popover.Trigger>
                    <Trigger name={current?.name} loading={loading} />
                </Popover.Trigger>

                <Popover.Content placement='bottom start' className='w-72 max-w-[calc(100vw_-_2rem)]'>
                    <Popover.Dialog className='p-1.5'>
                        <AutocompleteFilter filter={contains}>
                            <TextField
                                aria-label='Find organization'
                                autoFocus
                                fullWidth
                                className='border-0 bg-transparent pb-1 shadow-none'
                            >
                                <Input placeholder='Find organization…' className='border-0 bg-transparent shadow-none' />
                            </TextField>

                            <ListBox
                                aria-label='Organizations'
                                selectionMode='single'
                                disallowEmptySelection
                                selectedKeys={current ? [current.id] : []}
                                onSelectionChange={(keys) => {
                                    const [key] = keys === 'all' ? [] : keys;
                                    if(key !== undefined) setOrganizationId(Number(key));
                                    setOpen(false);
                                }}
                                renderEmptyState={() => (
                                    <p className='py-3 text-center text-[0.8125rem] text-muted'>No organizations found</p>
                                )}
                                className='max-h-64 overflow-y-auto'
                            >
                                {organizations.map((organization) => (
                                    <OrganizationRow key={organization.id} organization={organization} />
                                ))}
                            </ListBox>
                        </AutocompleteFilter>

                        <Separator className='my-1' />

                        <button
                            type='button'
                            className='flex min-h-9 w-full items-center gap-2 rounded-full px-2.5 text-[0.8125rem] text-muted transition-colors hover:bg-default hover:text-foreground'
                            onClick={() => {
                                setOpen(false);
                                setCreating(true);
                            }}
                        >
                            <Plus aria-hidden='true' className='size-4' />
                            Create Organization
                        </button>
                    </Popover.Dialog>
                </Popover.Content>
            </Popover.Root>

            <Modal isOpen={creating} onOpenChange={setCreating} title='Create organization'>
                <CreateOrganizationForm
                    onCreated={() => {
                        reload();
                        setCreating(false);
                    }}
                />
            </Modal>
        </>
    );
};

export default OrganizationSwitcher;
