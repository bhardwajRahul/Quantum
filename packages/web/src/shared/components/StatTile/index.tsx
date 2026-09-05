import { Card } from '@heroui/react';

interface StatTileProps{
    label: string;
    value: string;
}

const StatTile = ({ label, value }: StatTileProps) => (
    <Card>
        <Card.Content className='flex flex-col gap-1'>
            <span className='text-[0.8125rem] text-muted'>{label}</span>
            <span className='text-2xl font-medium text-foreground'>{value}</span>
        </Card.Content>
    </Card>
);

export default StatTile;
