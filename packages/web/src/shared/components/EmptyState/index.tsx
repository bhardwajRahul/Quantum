import { cn, EmptyStateRoot } from '@heroui/react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps{
    icon: LucideIcon;
    title: string;
    description?: string;
    compact?: boolean;
    /** Turns the slot into a live region and spins the icon, for something on its way. */
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
        className={cn('flex flex-col items-center text-center', compact ? 'px-4 py-8' : 'px-6 py-16')}
    >
        <span
            className={cn(
                'flex items-center justify-center rounded-full bg-foreground/[0.06]',
                compact ? 'size-10' : 'size-12'
            )}
        >
            <Icon
                aria-hidden='true'
                className={cn(
                    compact ? 'size-5' : 'size-6',
                    isBusy && 'animate-spin motion-reduce:animate-none'
                )}
            />
        </span>

        <h2 className={cn('font-medium text-foreground', compact ? 'mt-4 text-[0.875rem]' : 'mt-5 text-[0.9375rem]')}>
            {title}
        </h2>

        {description && <p className={compact ? 'mt-1.5 text-[0.8125rem]' : 'mt-2 max-w-sm'}>{description}</p>}

        {children && <div className={compact ? 'mt-4' : 'mt-6'}>{children}</div>}
    </EmptyStateRoot>
);

export default EmptyState;
