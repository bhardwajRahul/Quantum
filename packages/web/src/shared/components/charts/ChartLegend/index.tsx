export interface LegendEntry{
    label: string;
    className: string;
}

interface ChartLegendProps{
    entries: LegendEntry[];
}

/** Recharts' own legend is a table of squares; this is the one line it should be. */
const ChartLegend = ({ entries }: ChartLegendProps) => (
    <div className='flex flex-wrap gap-4 text-[0.8125rem] text-muted'>
        {entries.map((entry) => (
            <span key={entry.label} className='flex items-center gap-2'>
                <span className={`h-1 w-3 rounded-full ${entry.className}`} />
                {entry.label}
            </span>
        ))}
    </div>
);

export default ChartLegend;
