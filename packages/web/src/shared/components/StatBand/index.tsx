import type { ReactNode } from 'react';

interface StatBandProps{
    columns: 2 | 3 | 4 | 5;
    children: ReactNode;
}

const COLUMNS: Record<StatBandProps['columns'], string> = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 lg:grid-cols-5'
};

const StatBand = ({ columns, children }: StatBandProps) => (
    <section className={`grid border-y border-border [&>*+*]:border-l [&>*+*]:border-separator [&>*+*]:pl-6 ${COLUMNS[columns]}`}>
        {children}
    </section>
);

export default StatBand;
