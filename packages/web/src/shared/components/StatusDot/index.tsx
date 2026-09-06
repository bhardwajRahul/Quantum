import { cn } from '@heroui/react';
import type { StatusColor } from '@/shared/utils/status';

interface StatusDotProps{
    color: StatusColor;
    label: string;
    isTransient?: boolean;
    className?: string;
}

const DOT: Record<StatusColor, string> = {
    success: 'bg-foreground',
    accent: 'bg-foreground',
    default: 'bg-foreground/30',
    warning: 'bg-warning',
    danger: 'bg-danger'
};

const TEXT: Record<StatusColor, string> = {
    success: 'text-foreground',
    accent: 'text-foreground',
    default: 'text-muted',
    warning: 'text-foreground',
    danger: 'text-foreground'
};

const StatusDot = ({ color, label, isTransient = false, className }: StatusDotProps) => (
    <span className={cn('inline-flex items-center gap-2.5 whitespace-nowrap text-sm', TEXT[color], className)}>
        <span
            aria-hidden='true'
            className={cn('size-[7px] shrink-0 rounded-full', isTransient ? 'status-dot-transient' : DOT[color])}
        />
        {label}
    </span>
);

export default StatusDot;
