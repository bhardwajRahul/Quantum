import { useState } from 'react';
import { Chip, ComboBox, Input, Label, ListBox, ListBoxItem } from '@heroui/react';
import { FolderGit2, Search } from 'lucide-react';
import EmptyState from '@/shared/components/EmptyState';
import CenterState from '@/shared/components/CenterState';
import ConnectGithubButton from '@/modules/github/components/ConnectGithubButton';
import type { GithubAccount, GithubRepository } from '@quantum/contracts/modules/github/domain';

const PACKAGES_SCOPE = 'read:packages';

interface RepositoryPickerProps{
    repositories: GithubRepository[];
    account?: GithubAccount | null;
    onSelect: (repository: GithubRepository) => void;
}

const RepositoryPicker = ({ repositories, account = null, onSelect }: RepositoryPickerProps) => {
    const [query, setQuery] = useState('');
    const scopes = account?.scopes ?? [];
    const missingPackages = scopes.length > 0 && !scopes.includes(PACKAGES_SCOPE);

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
                {account?.organizationAccessUrl && (
                    <>
                        {' '}Missing an organization&apos;s repositories?{' '}
                        <a
                            href={account.organizationAccessUrl}
                            target='_blank'
                            rel='noreferrer'
                            className='text-foreground underline underline-offset-4 hover:no-underline'
                        >
                            Grant Quantum access to it on GitHub
                        </a>
                        .
                    </>
                )}
            </p>

            {missingPackages && (
                <div className='mt-2 flex flex-col gap-3'>
                    <p className='text-[0.8125rem] text-muted'>
                        This connection was made before Quantum asked for package access, so private GitHub Container Registry
                        images will not pull. Reconnect once to grant it.
                    </p>
                    <ConnectGithubButton label='Reconnect GitHub' />
                </div>
            )}
        </div>
    );
};

export default RepositoryPicker;
