import type { ReactNode } from 'react';

interface StatTileProps{
    label: string;
    value: string;
    hint?: string;
    children?: ReactNode;
}

const StatTile = ({ label, value, hint, children }: StatTileProps) => (
    <section className='flex min-w-0 flex-col py-6 pr-6'>
        <h2 className='label-caps text-muted'>{label}</h2>
        <p className='title-display mt-3 truncate text-[2.375rem] leading-none tabular-nums text-foreground'>{value}</p>
        {hint !== undefined && <p className='mt-2 truncate text-[0.8125rem] text-muted'>{hint}</p>}
        {children}
    </section>
);

export default StatTile;
