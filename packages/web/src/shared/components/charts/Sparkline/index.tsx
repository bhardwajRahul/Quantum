import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface SparklineProps{
    values: number[];
}

const Sparkline = ({ values }: SparklineProps) => {
    if(values.length === 0) return null;

    const points = values.map((value, index) => ({ index, value }));

    return (
        <div className='mt-3 h-10'>
            <ResponsiveContainer width='100%' height='100%'>
                <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                    <Area
                        type='monotone'
                        dataKey='value'
                        stroke='var(--foreground)'
                        strokeWidth={1.5}
                        fill='var(--foreground)'
                        fillOpacity={0.08}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export default Sparkline;
