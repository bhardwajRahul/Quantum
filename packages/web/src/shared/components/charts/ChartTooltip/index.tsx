export interface TooltipRow{
    label: string;
    value: string;
}

interface ChartTooltipProps{
    title: string;
    rows: TooltipRow[];
}

const ChartTooltip = ({ title, rows }: ChartTooltipProps) => (
    <div className='border border-border bg-overlay px-3 py-2 text-[0.8125rem]'>
        <p className='label-caps text-muted'>{title}</p>

        {rows.map((row) => (
            <p key={row.label} className='mt-1.5 flex items-baseline justify-between gap-6'>
                <span className='text-muted'>{row.label}</span>
                <span className='font-medium tabular-nums text-foreground'>{row.value}</span>
            </p>
        ))}
    </div>
);

export default ChartTooltip;
