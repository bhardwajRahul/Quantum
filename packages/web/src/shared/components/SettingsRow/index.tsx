import type { ReactNode } from 'react';

interface SettingsRowProps{
    title: string;
    description?: string;
    action?: ReactNode;
    children?: ReactNode;
}

const SettingsRow = ({ title, description, action, children }: SettingsRowProps) => (
    <div className='border-b border-separator py-4 first:pt-0 last:border-0 last:pb-0'>
        <div className='flex flex-wrap items-center justify-between gap-4'>
            <div className='flex min-w-0 flex-col gap-0.5'>
                <span className='text-sm text-foreground'>{title}</span>
                {description !== undefined && <span className='text-[0.8125rem] text-muted'>{description}</span>}
            </div>

            {action !== undefined && <div className='shrink-0'>{action}</div>}
        </div>

        {children !== undefined && <div className='mt-4'>{children}</div>}
    </div>
);

export default SettingsRow;
