import { cn } from '@heroui/react';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

interface LoadingStateProps{
    title: string;
    description?: string;
    compact?: boolean;
    children?: ReactNode;
}

const LoadingState = ({ title, description, compact = false, children }: LoadingStateProps) => (
    <div role='status' className={cn('flex flex-col items-center text-center', compact ? 'px-4 py-8' : 'px-6 py-16')}>
        <span
            className={cn(
                'flex items-center justify-center rounded-full bg-foreground/[0.06]',
                compact ? 'size-10' : 'size-12'
            )}
        >
            <Loader2
                aria-hidden='true'
                className={cn('animate-spin motion-reduce:animate-none', compact ? 'size-5' : 'size-6')}
            />
        </span>

        <h2 className={cn('font-medium text-foreground', compact ? 'mt-4 text-[0.875rem]' : 'mt-5 text-[0.9375rem]')}>
            {title}
        </h2>

        {description && (
            <p className={cn('text-muted', compact ? 'mt-1.5 text-[0.8125rem]' : 'mt-2 max-w-sm')}>{description}</p>
        )}

        {children && <div className={compact ? 'mt-4' : 'mt-6'}>{children}</div>}
    </div>
);

export default LoadingState;
