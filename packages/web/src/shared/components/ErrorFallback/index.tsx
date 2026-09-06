import { Button } from '@heroui/react';
import type { ErrorFallbackProps } from '@/shared/contracts/boundary';

const ErrorFallback = ({ error, reset }: ErrorFallbackProps) => {
    return (
        <main className='dot-grid flex min-h-dvh items-center justify-center bg-background p-6'>
            <section className='flex w-full max-w-md flex-col items-start'>
                <p className='label-caps text-danger'>Error</p>
                <h1 className='title-display mt-5 text-[2.75rem] leading-[1.02] text-foreground'>Something went wrong</h1>
                <p className='mt-4 text-sm text-muted'>
                    An unexpected error interrupted this page. You can try again, or reload if the problem persists.
                </p>

                {import.meta.env.DEV && (
                    <pre className='mt-6 w-full overflow-auto border border-border p-3 text-left font-mono text-xs text-muted'>
                        {error.message}
                        {error.stack ? `\n\n${error.stack}` : ''}
                    </pre>
                )}

                <div className='mt-9 flex gap-3'>
                    <Button onPress={reset}>Try again</Button>
                    <Button variant='secondary' onPress={() => window.location.reload()}>Reload</Button>
                </div>
            </section>
        </main>
    );
};

export default ErrorFallback;
