import { ListBox, ListBoxItem, Select } from '@heroui/react';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';

const ROLES: OrganizationRole[] = [
    OrganizationRole.Owner,
    OrganizationRole.Admin,
    OrganizationRole.Member,
    OrganizationRole.Viewer
];

const ROLE_LABELS: Record<OrganizationRole, string> = {
    [OrganizationRole.Owner]: 'Owner',
    [OrganizationRole.Admin]: 'Admin',
    [OrganizationRole.Member]: 'Member',
    [OrganizationRole.Viewer]: 'Viewer'
};

interface RoleSelectProps{
    value: OrganizationRole;
    onChange: (role: OrganizationRole) => void;
    isDisabled?: boolean;
    ariaLabel?: string;
}

const RoleSelect = ({ value, onChange, isDisabled = false, ariaLabel = 'Role' }: RoleSelectProps) => (
    <Select
        aria-label={ariaLabel}
        selectedKey={value}
        isDisabled={isDisabled}
        onSelectionChange={(key) => onChange(key as OrganizationRole)}
    >
        <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
        </Select.Trigger>

        <Select.Popover>
            <ListBox>
                {ROLES.map((role) => (
                    <ListBoxItem key={role} id={role} textValue={ROLE_LABELS[role]}>
                        {ROLE_LABELS[role]}
                    </ListBoxItem>
                ))}
            </ListBox>
        </Select.Popover>
    </Select>
);

export default RoleSelect;
