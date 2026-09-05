import type { ReactNode } from 'react';

interface PageHeaderProps{
    title: string;
    description?: string;
    actions?: ReactNode;
    filter?: ReactNode;
}

const PageHeader = ({ title, description, actions, filter }: PageHeaderProps) => (
    <div className='flex items-center justify-between gap-4'>
        <div>
            <h1 className='text-lg font-medium text-foreground'>{title}</h1>
            {description !== undefined && <p className='mt-1.5 text-sm text-muted'>{description}</p>}
        </div>

        {actions}
        {filter}
    </div>
);

export default PageHeader;
