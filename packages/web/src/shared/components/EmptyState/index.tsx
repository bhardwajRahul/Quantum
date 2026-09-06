import { cn, EmptyStateRoot } from '@heroui/react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps{
    icon?: LucideIcon;
    title: string;
    description?: string;
    compact?: boolean;
    isBusy?: boolean;
    children?: ReactNode;
}

const EmptyState = ({
    icon: Icon,
    title,
    description,
    compact = false,
    isBusy = false,
    children
}: EmptyStateProps) => (
    <EmptyStateRoot
        role={isBusy ? 'status' : undefined}
        aria-live={isBusy ? 'polite' : undefined}
        className={cn(
            'dot-grid flex flex-col items-center text-center',
            compact ? 'px-4 py-10' : 'px-6 py-20'
        )}
    >
        {Icon !== undefined && (
            <Icon
                aria-hidden='true'
                className={cn('size-5 text-muted', isBusy && 'animate-spin motion-reduce:animate-none')}
            />
        )}

        <h2
            className={cn(
                'title-display text-foreground',
                compact ? 'mt-4 text-xl' : 'mt-6 text-[2rem] leading-[1.05]',
                Icon === undefined && 'mt-0'
            )}
        >
            {title}
        </h2>

        {description && (
            <p className={cn('text-muted', compact ? 'mt-2 max-w-sm text-[0.8125rem]' : 'mt-4 max-w-md text-sm')}>
                {description}
            </p>
        )}

        {children && <div className={compact ? 'mt-5' : 'mt-8'}>{children}</div>}
    </EmptyStateRoot>
);

export default EmptyState;
