import type { ReactNode } from 'react';

interface ChartPanelProps{
    title: string;
    meta?: string;
    children: ReactNode;
}

const ChartPanel = ({ title, meta, children }: ChartPanelProps) => (
    <section className='flex min-w-0 flex-col gap-4 border-t border-border pt-5'>
        <header className='flex items-baseline justify-between gap-3'>
            <h2 className='text-[0.9375rem] font-medium text-foreground'>{title}</h2>
            {meta !== undefined && <span className='label-caps shrink-0 text-muted'>{meta}</span>}
        </header>

        {children}
    </section>
);

export default ChartPanel;
