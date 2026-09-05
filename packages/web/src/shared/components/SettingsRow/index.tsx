import type { ReactNode } from 'react';

interface SettingsRowProps{
    title: string;
    description: string;
    action?: ReactNode;
    children?: ReactNode;
}

/**
 * One setting per row: what it is on the left, what you can do about it on the right.
 * Filled rather than outlined, so a column of them reads as a list instead of a stack
 * of cards — and a row that needs a whole form drops it underneath instead of trying
 * to fit beside the description.
 */
const SettingsRow = ({ title, description, action, children }: SettingsRowProps) => (
    <section className='rounded-2xl bg-foreground/[0.04] p-5'>
        <div className='flex flex-wrap items-center justify-between gap-4'>
            <div className='flex min-w-0 flex-col gap-0.5'>
                <span className='text-[0.875rem] font-medium text-foreground'>{title}</span>
                <span className='text-[0.8125rem] text-muted'>{description}</span>
            </div>

            {action !== undefined && <div className='shrink-0'>{action}</div>}
        </div>

        {children !== undefined && <div className='mt-4'>{children}</div>}
    </section>
);

export default SettingsRow;
