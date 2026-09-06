import { count, share } from '@/shared/utils/format-metrics';

export interface TopListEntry{
    key: string;
    value: number;
}

interface TopListProps{
    title: string;
    entries: TopListEntry[];
    emptyLabel?: string;
}

const TopList = ({ title, entries, emptyLabel = 'No data yet' }: TopListProps) => {
    const total = entries.reduce((sum, entry) => sum + entry.value, 0);
    const largest = Math.max(0, ...entries.map((entry) => entry.value));

    return (
        <section className='flex min-w-0 flex-col border-t border-border pt-5'>
            <h2 className='text-[0.9375rem] font-medium text-foreground'>{title}</h2>

            {entries.length === 0 ? (
                <p className='mt-3 text-[0.8125rem] text-muted'>{emptyLabel}</p>
            ) : (
                <ol className='mt-3 flex flex-col gap-1.5'>
                    {entries.map((entry) => (
                        <li key={entry.key} className='relative overflow-hidden'>
                            <span
                                aria-hidden='true'
                                className='absolute inset-y-0 left-0 bg-foreground/[0.06]'
                                style={{ width: largest === 0 ? '0%' : `${(entry.value / largest) * 100}%` }}
                            />

                            <span className='relative flex items-baseline justify-between gap-3 px-2 py-1'>
                                <span className='truncate text-[0.8125rem] text-foreground'>{entry.key}</span>
                                <span className='shrink-0 text-[0.8125rem] tabular-nums text-muted'>
                                    {count(entry.value)}
                                    <span className='ml-2 text-muted/70'>{share(entry.value, total)}</span>
                                </span>
                            </span>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
};

export default TopList;
