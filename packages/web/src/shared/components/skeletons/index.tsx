import { cn, Skeleton } from '@heroui/react';
import PageBody from '@/shared/components/layout/PageBody';
import type { ReactNode } from 'react';

const WIDTHS = ['w-2/3', 'w-1/2', 'w-1/3', 'w-3/4', 'w-1/4', 'w-1/2'];

const columnsStyle = (columns: number) => ({ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` });

interface LoadingProps{
    className?: string;
    children: ReactNode;
}

const Loading = ({ className, children }: LoadingProps) => (
    <div role='status' aria-label='Loading' aria-busy='true' className={className}>{children}</div>
);

interface TableSkeletonProps{
    rows?: number;
    columns?: number;
    className?: string;
}

export const TableSkeleton = ({ rows = 6, columns = 4, className }: TableSkeletonProps) => (
    <Loading className={cn('w-full', className)}>
        <div className='grid gap-x-8 border-b border-border pb-3' style={columnsStyle(columns)}>
            {Array.from({ length: columns }, (_, column) => <Skeleton key={column} className='h-3 w-20' />)}
        </div>
        {Array.from({ length: rows }, (_, row) => (
            <div key={row} className='grid gap-x-8 border-b border-border py-4' style={columnsStyle(columns)}>
                {Array.from({ length: columns }, (_, column) => (
                    <Skeleton key={column} className={cn('h-3.5', WIDTHS[(row + column) % WIDTHS.length])} />
                ))}
            </div>
        ))}
    </Loading>
);

interface ActionsProps{
    count: number;
}

const Actions = ({ count }: ActionsProps) => (
    <div className='flex flex-wrap gap-2'>
        {Array.from({ length: count }, (_, index) => <Skeleton key={index} className='h-10 w-28' />)}
    </div>
);

interface PageHeaderSkeletonProps{
    actions?: number;
}

export const PageHeaderSkeleton = ({ actions = 0 }: PageHeaderSkeletonProps) => (
    <div className='flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between'>
        <div className='min-w-0'>
            <Skeleton className='h-9 w-56 max-w-full' />
            <Skeleton className='mt-4 h-4 w-96 max-w-full' />
        </div>
        {actions > 0 && <Actions count={actions} />}
    </div>
);

interface PageSkeletonProps{
    actions?: number;
    columns?: number;
    rows?: number;
    children?: ReactNode;
}

export const PageSkeleton = ({ actions = 0, columns = 4, rows = 6, children }: PageSkeletonProps) => (
    <PageBody width='wide' height='full'>
        <Loading>
            <PageHeaderSkeleton actions={actions} />
            <div className='mt-8'>{children ?? <TableSkeleton rows={rows} columns={columns} />}</div>
        </Loading>
    </PageBody>
);

interface DetailHeaderSkeletonProps{
    actions?: number;
    tabs?: number;
}

export const DetailHeaderSkeleton = ({ actions = 4, tabs = 4 }: DetailHeaderSkeletonProps) => (
    <Loading>
        <div className='flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between'>
            <div className='min-w-0'>
                <Skeleton className='h-3 w-40' />
                <Skeleton className='mt-5 h-9 w-72 max-w-full' />
                <Skeleton className='mt-4 h-4 w-64 max-w-full' />
            </div>
            <Actions count={actions} />
        </div>
        <div className='mt-8 flex gap-8 border-b border-border pb-3.5'>
            {Array.from({ length: tabs }, (_, index) => <Skeleton key={index} className='h-3 w-16' />)}
        </div>
        <TableSkeleton className='mt-8' rows={3} />
    </Loading>
);

interface FieldsSkeletonProps{
    rows?: number;
    className?: string;
}

export const FieldsSkeleton = ({ rows = 4, className }: FieldsSkeletonProps) => (
    <Loading className={cn('flex w-full max-w-2xl flex-col gap-6', className)}>
        {Array.from({ length: rows }, (_, index) => (
            <div key={index}>
                <Skeleton className='h-3 w-24' />
                <Skeleton className='mt-2.5 h-10 w-full' />
            </div>
        ))}
    </Loading>
);

interface LinesSkeletonProps{
    lines?: number;
    className?: string;
}

export const LinesSkeleton = ({ lines = 3, className }: LinesSkeletonProps) => (
    <Loading className={cn('flex flex-col gap-3', className)}>
        {Array.from({ length: lines }, (_, index) => <Skeleton key={index} className={cn('h-3.5', WIDTHS[index % WIDTHS.length])} />)}
    </Loading>
);

interface StatBandSkeletonProps{
    columns?: number;
}

export const StatBandSkeleton = ({ columns = 4 }: StatBandSkeletonProps) => (
    <div className='grid border-y border-border [&>*+*]:border-l [&>*+*]:border-separator [&>*+*]:pl-6' style={columnsStyle(columns)}>
        {Array.from({ length: columns }, (_, index) => (
            <div key={index} className='py-6 pr-6'>
                <Skeleton className='h-3 w-16' />
                <Skeleton className='mt-4 h-9 w-24' />
                <Skeleton className='mt-3 h-3 w-28 max-w-full' />
            </div>
        ))}
    </div>
);

interface ChartSkeletonProps{
    className?: string;
}

export const ChartSkeleton = ({ className }: ChartSkeletonProps) => (
    <div className={className}>
        <div className='flex items-center justify-between'>
            <Skeleton className='h-4 w-24' />
            <Skeleton className='h-3 w-20' />
        </div>
        <Skeleton className='mt-5 h-64 w-full' />
    </div>
);

export const SplitSkeleton = () => (
    <Loading className='flex h-full min-h-0 flex-col lg:flex-row'>
        <div className='flex w-full shrink-0 flex-col gap-4 border-b border-border px-5 pb-6 pt-8 lg:h-full lg:w-[24rem] lg:border-b-0 lg:border-r'>
            <Skeleton className='h-3 w-32' />
            <Skeleton className='h-10 w-full' />
            {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className='border-b border-border py-3'>
                    <Skeleton className={cn('h-3.5', WIDTHS[index % WIDTHS.length])} />
                </div>
            ))}
        </div>
        <div className='flex-1 px-5 pt-8 sm:px-8 lg:px-10'>
            <Skeleton className='h-3 w-24' />
            <Skeleton className='mt-5 h-9 w-64 max-w-full' />
            <Skeleton className='mt-4 h-4 w-full max-w-lg' />
            <Skeleton className='mt-2 h-4 w-3/4 max-w-md' />
            <Skeleton className='mt-8 h-10 w-32' />
        </div>
    </Loading>
);
