import { Button } from '@heroui/react';

interface ServerUnreachableProps{
    onRetry: () => void;
}

const ServerUnreachable = ({ onRetry }: ServerUnreachableProps) => (
    <div className='dot-grid flex min-h-dvh items-center justify-center bg-background px-6'>
        <section className='flex w-full max-w-md flex-col items-start'>
            <p className='label-caps text-muted'>Connection</p>
            <h1 className='title-display mt-5 text-[2.75rem] leading-[1.02] text-foreground'>We cannot reach the server</h1>
            <p className='mt-4 text-sm text-muted'>
                Your session is still here. This is the server not answering, so nothing was lost —
                try again once it is back.
            </p>

            <Button className='mt-9' onPress={onRetry}>Try again</Button>
        </section>
    </div>
);

export default ServerUnreachable;
