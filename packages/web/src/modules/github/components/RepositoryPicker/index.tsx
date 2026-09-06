import { useState } from 'react';
import { Chip, ComboBox, Input, Label, ListBox, ListBoxItem } from '@heroui/react';
import { FolderGit2, Search } from 'lucide-react';
import EmptyState from '@/shared/components/EmptyState';
import CenterState from '@/shared/components/CenterState';
import type { GithubRepository } from '@quantum/contracts/modules/github/domain';

interface RepositoryPickerProps{
    repositories: GithubRepository[];
    onSelect: (repository: GithubRepository) => void;
}

const RepositoryPicker = ({ repositories, onSelect }: RepositoryPickerProps) => {
    const [query, setQuery] = useState('');

    if(repositories.length === 0){
        return (
            <CenterState className='h-full'>
                <EmptyState
                    icon={FolderGit2}
                    title='No repositories found'
                    description='Push a repository to your GitHub account to import it here.'
                />
            </CenterState>
        );
    }

    const needle = query.trim().toLowerCase();
    const visible = needle === ''
        ? repositories
        : repositories.filter((repository) => repository.fullName.toLowerCase().includes(needle));

    return (
        <div className='flex w-full max-w-xl flex-col gap-1.5'>
            <Label id='repository-picker-label'>Repository</Label>

            <ComboBox
                aria-labelledby='repository-picker-label'
                inputValue={query}
                onInputChange={setQuery}
                onSelectionChange={(key) => {
                    const repository = repositories.find((candidate) => candidate.fullName === key);
                    if(repository !== undefined) onSelect(repository);
                }}
                allowsEmptyCollection
                fullWidth
            >
                <ComboBox.InputGroup>
                    <Input className='font-mono' placeholder='Search your repositories…' autoComplete='off' />
                    <ComboBox.Trigger />
                </ComboBox.InputGroup>

                <ComboBox.Popover>
                    <ListBox
                        aria-labelledby='repository-picker-label'
                        renderEmptyState={() => (
                            <EmptyState icon={Search} title='No matches' description='Try a different search term.' compact />
                        )}
                    >
                        {visible.map((repository) => (
                            <ListBoxItem
                                key={repository.fullName}
                                id={repository.fullName}
                                textValue={repository.fullName}
                            >
                                <div className='flex w-full items-center justify-between gap-4 py-0.5 text-left'>
                                    <span className='truncate font-mono text-[0.8125rem]'>{repository.fullName}</span>
                                    <Chip size='sm' variant='soft'>
                                        {repository.private ? 'Private' : 'Public'}
                                    </Chip>
                                </div>
                            </ListBoxItem>
                        ))}
                    </ListBox>
                </ComboBox.Popover>
            </ComboBox>

            <p className='text-[0.8125rem] text-muted'>
                {repositories.length} {repositories.length === 1 ? 'repository' : 'repositories'} available. Type to narrow them down.
            </p>
        </div>
    );
};

export default RepositoryPicker;
