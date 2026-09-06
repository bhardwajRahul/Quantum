import { NavLink, Outlet, useParams } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import EmptyState from '@/shared/components/EmptyState';
import ErrorState from '@/shared/components/ErrorState';
import CenterState from '@/shared/components/CenterState';
import StatusDot from '@/shared/components/StatusDot';
import { useQuery } from '@/shared/hooks/api/use-query';
import { repositoryApi } from '@/modules/repository/api/api';
import {
    containerStatusColor,
    containerStatusLabel,
    isContainerTransient
} from '@/modules/application/utils/container-status';
import { repositoryDetailErrorMessages } from '@/modules/repository/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import type { Repository } from '@quantum/contracts/modules/repository/domain';

const copy = errorCopy(repositoryDetailErrorMessages);

const TABS = [
    { label: 'Deployments', to: 'deployments' },
    { label: 'Environment', to: 'environment-variables' },
    { label: 'Logs', to: 'logs' },
    { label: 'Shell', to: 'shell' },
    { label: 'Settings', to: 'settings' }
] as const;

const tabClass = (active: boolean): string =>
    `label-caps -mb-px shrink-0 whitespace-nowrap border-b pb-3.5 transition-colors focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-foreground motion-reduce:transition-none ${
        active ? 'border-foreground text-foreground' : 'border-transparent text-muted hover:text-foreground'
    }`;

const sourceLabel = (url: string): string => url.replace(/^https?:\/\//, '').replace(/\.git$/, '');

interface RepositoryHeaderProps{
    repository: Repository;
}

const RepositoryHeader = ({ repository }: RepositoryHeaderProps) => (
    <header className='min-w-0'>
        <p className='label-caps flex items-center gap-2 text-muted'>
            <NavLink to='/applications' className='transition-colors hover:text-foreground motion-reduce:transition-none'>
                Applications
            </NavLink>
            <span aria-hidden='true'>/</span>
            <span className='truncate text-foreground/70'>{repository.alias}</span>
        </p>

        <h1 className='title-display mt-4 truncate text-[2.125rem] leading-[1.1] text-foreground'>{repository.alias}</h1>

        <div className='mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted'>
            <StatusDot
                color={containerStatusColor(repository.containerStatus)}
                label={containerStatusLabel(repository.containerStatus)}
                isTransient={isContainerTransient(repository.containerStatus)}
            />
            {repository.framework !== null && <span>· {repository.framework}</span>}
            <span>· {repository.branch}</span>
            <a
                href={repository.url}
                target='_blank'
                rel='noreferrer'
                className='inline-flex items-center gap-1 font-mono text-[0.8125rem] transition-colors hover:text-foreground motion-reduce:transition-none'
            >
                · {sourceLabel(repository.url)}
                <ArrowUpRight aria-hidden='true' className='size-3.5' />
            </a>
        </div>
    </header>
);

const RepositoryLayout = () => {
    const { repositoryId } = useParams<{ repositoryId: string }>();
    const id = repositoryId !== undefined ? Number(repositoryId) : undefined;

    const repository = useQuery((repositoryId: number) => repositoryApi.get({ path: { id: repositoryId } }), [id]);

    if(repository.loading && repository.data === null){
        return (
            <PageBody width='wide' height='full'>
                <CenterState className='h-full'>
                    <EmptyState title='Loading repository' loading compact />
                </CenterState>
            </PageBody>
        );
    }

    if(repository.error !== undefined){
        return (
            <PageBody width='wide'>
                <ErrorState
                    title='Could not load repository'
                    description={copy(repository.error)}
                    onRetry={repository.reload}
                />
            </PageBody>
        );
    }

    if(repository.data === null) return null;

    return (
        <PageBody width='wide' height='full'>
            <RepositoryHeader repository={repository.data} />

            <nav aria-label='Repository' className='mt-8 flex shrink-0 gap-8 overflow-x-auto border-b border-border'>
                {TABS.map((tab) => (
                    <NavLink key={tab.to} to={tab.to} className={({ isActive }) => tabClass(isActive)}>
                        {tab.label}
                    </NavLink>
                ))}
            </nav>

            <div className='flex min-h-0 flex-1 flex-col pt-8'>
                <Outlet />
            </div>
        </PageBody>
    );
};

export default RepositoryLayout;
