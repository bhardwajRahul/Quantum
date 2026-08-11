import { Button } from '@heroui/react';

interface ErrorStateProps{
    title: string;
    description: string;
    onRetry: () => void;
}

const ErrorState = ({ title, description, onRetry }: ErrorStateProps) => (
    <section className='flex flex-col items-start gap-4 rounded-xl bg-foreground/[0.04] p-5'>
        <div className='flex flex-col gap-1'>
            <h2 className='text-[0.9375rem] font-medium text-foreground'>{title}</h2>
            <p className='text-[0.875rem] text-muted'>{description}</p>
        </div>

        <Button variant='secondary' onPress={onRetry}>Try again</Button>
    </section>
);

export default ErrorState;
