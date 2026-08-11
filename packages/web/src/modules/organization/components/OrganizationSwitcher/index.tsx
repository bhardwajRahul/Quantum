import { ListBox, ListBoxItem, Select } from '@heroui/react';
import { useTenancy } from '@/modules/organization/hooks/use-tenancy';
import { useTenantStore } from '@/shared/store/tenant';

const OrganizationSwitcher = () => {
    const { organizations, current } = useTenancy();
    const setOrganizationId = useTenantStore((state) => state.setOrganizationId);

    if(organizations.length === 0) return null;

    return (
        <Select
            aria-label='Current organization'
            selectedKey={current?.id ?? null}
            onSelectionChange={(key) => setOrganizationId(Number(key))}
        >
            <Select.Trigger className='min-w-40 max-w-56'>
                <Select.Value />
                <Select.Indicator />
            </Select.Trigger>

            <Select.Popover>
                <ListBox>
                    {organizations.map((organization) => (
                        <ListBoxItem key={organization.id} id={organization.id} textValue={organization.name}>
                            {organization.name}
                        </ListBoxItem>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
};

export default OrganizationSwitcher;
