import { ListBox, ListBoxItem, Select } from '@heroui/react';
import type { Repository } from '@quantum/contracts/modules/repository/domain';

const labelOf = (repository: Repository): string =>
    repository.name !== '' ? repository.name : repository.alias;

interface RepositorySelectProps{
    repositories: Repository[];
    value: number | null;
    onChange: (repositoryId: number) => void;
    isDisabled?: boolean;
    ariaLabel?: string;
}

const RepositorySelect = ({
    repositories,
    value,
    onChange,
    isDisabled = false,
    ariaLabel = 'Repository'
}: RepositorySelectProps) => (
    <Select
        aria-label={ariaLabel}
        selectedKey={value ?? null}
        isDisabled={isDisabled}
        onSelectionChange={(key) => onChange(Number(key))}
    >
        <Select.Trigger>
            <Select.Value>Select a repository</Select.Value>
            <Select.Indicator />
        </Select.Trigger>

        <Select.Popover>
            <ListBox>
                {repositories.map((repository) => (
                    <ListBoxItem
                        key={repository.id}
                        id={repository.id}
                        textValue={labelOf(repository)}
                    >
                        {labelOf(repository)}
                    </ListBoxItem>
                ))}
            </ListBox>
        </Select.Popover>
    </Select>
);

export default RepositorySelect;
