import { cn } from '@heroui/react';

interface InlineErrorProps{
    children: string;
    className?: string;
}

const InlineError = ({ children, className }: InlineErrorProps) => (
    <p role='alert' className={cn('text-[0.8125rem] text-[var(--danger)]', className)}>
        {children}
    </p>
);

export default InlineError;
