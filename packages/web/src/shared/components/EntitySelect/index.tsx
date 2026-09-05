import { ListBox, ListBoxItem, Select } from '@heroui/react';

interface EntitySelectProps<T>{
    items: T[];
    getKey: (item: T) => string | number;
    getLabel: (item: T) => string;
    value: string | number | null;
    onChange: (key: string | number) => void;
    placeholder?: string;
    ariaLabel?: string;
    isDisabled?: boolean;
}

const EntitySelect = <T,>({
    items,
    getKey,
    getLabel,
    value,
    onChange,
    placeholder,
    ariaLabel = 'Select',
    isDisabled = false
}: EntitySelectProps<T>) => (
    <Select
        aria-label={ariaLabel}
        placeholder={placeholder}
        selectedKey={value ?? null}
        isDisabled={isDisabled}
        onSelectionChange={(key) => onChange(key as string | number)}
    >
        <Select.Trigger>
            {/*
              * `Select.Value` must stay childless. React Aria only falls back to the
              * selected item when children are null — anything else wins outright, so
              * putting the placeholder here pinned the trigger to it forever and the
              * select looked broken. The root's `placeholder` prop is the fallback.
              */}
            <Select.Value />
            <Select.Indicator />
        </Select.Trigger>

        <Select.Popover>
            <ListBox>
                {items.map((item) => (
                    <ListBoxItem key={getKey(item)} id={getKey(item)} textValue={getLabel(item)}>
                        {getLabel(item)}
                    </ListBoxItem>
                ))}
            </ListBox>
        </Select.Popover>
    </Select>
);

export default EntitySelect;
