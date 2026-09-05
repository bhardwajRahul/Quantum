import type { ReactNode } from 'react';

interface StatTileProps{
    label: string;
    value: string;
    hint?: string;
    children?: ReactNode;
}

/**
 * Flush by design: no card, no border. Tiles are meant to sit in a grid and read as one
 * band of numbers, with the grid's own rules doing the separating — a border round each
 * one turns six figures into six boxes.
 */
const StatTile = ({ label, value, hint, children }: StatTileProps) => (
    <section className='flex min-w-0 flex-col px-5 py-4'>
        <h2 className='text-[0.8125rem] text-muted'>{label}</h2>
        <p className='mt-1 truncate text-2xl font-semibold tabular-nums text-foreground'>{value}</p>
        {hint !== undefined && <p className='mt-1 truncate text-[0.8125rem] text-muted'>{hint}</p>}
        {children}
    </section>
);

export default StatTile;
