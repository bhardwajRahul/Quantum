import type { ReactNode } from 'react';

interface PageHeaderProps{
    eyebrow?: ReactNode;
    title: string;
    description?: string;
    actions?: ReactNode;
    filter?: ReactNode;
}

const PageHeader = ({ eyebrow, title, description, actions, filter }: PageHeaderProps) => (
    <div className='flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between'>
        <div className='min-w-0'>
            {eyebrow !== undefined && <p className='label-caps mb-4 text-muted'>{eyebrow}</p>}

            <h1 className='title-display text-[2.125rem] leading-[1.1] text-foreground'>{title}</h1>

            {description !== undefined && (
                <p className='mt-3 max-w-[58ch] text-sm text-muted'>{description}</p>
            )}
        </div>

        {(actions !== undefined || filter !== undefined) && (
            <div className='flex shrink-0 flex-wrap items-center gap-3'>
                {filter}
                {actions}
            </div>
        )}
    </div>
);

export default PageHeader;
