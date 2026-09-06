import { Button } from '@heroui/react';

interface ErrorStateProps{
    title: string;
    description: string;
    onRetry: () => void;
}

const ErrorState = ({ title, description, onRetry }: ErrorStateProps) => (
    <section className='flex flex-col items-start gap-5 border border-border p-6'>
        <div className='flex flex-col gap-2'>
            <h2 className='title-display text-xl text-foreground'>{title}</h2>
            <p className='max-w-md text-sm text-muted'>{description}</p>
        </div>

        <Button variant='secondary' onPress={onRetry}>Try again</Button>
    </section>
);

export default ErrorState;
