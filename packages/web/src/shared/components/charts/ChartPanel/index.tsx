import type { ReactNode } from 'react';

interface ChartPanelProps{
    title: string;
    meta?: string;
    children: ReactNode;
}

const ChartPanel = ({ title, meta, children }: ChartPanelProps) => (
    <section className='flex min-w-0 flex-col gap-3 rounded-xl border border-border p-4'>
        <header className='flex items-baseline justify-between gap-3'>
            <h2 className='text-[0.9375rem] font-medium text-foreground'>{title}</h2>
            {meta !== undefined && <span className='shrink-0 text-[0.8125rem] text-muted'>{meta}</span>}
        </header>

        {children}
    </section>
);

export default ChartPanel;
