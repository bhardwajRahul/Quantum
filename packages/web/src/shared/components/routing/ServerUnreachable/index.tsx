import { Button } from '@heroui/react';
import { CloudOff } from 'lucide-react';

interface ServerUnreachableProps{
    onRetry: () => void;
}

const ServerUnreachable = ({ onRetry }: ServerUnreachableProps) => (
    <div className='flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 text-center'>
        <span className='flex size-12 items-center justify-center rounded-full bg-foreground/[0.06]'>
            <CloudOff className='size-6 text-muted' aria-hidden='true' />
        </span>

        <div className='flex flex-col gap-1.5'>
            <h1 className='text-[0.9375rem] font-medium text-foreground'>We cannot reach the server</h1>
            <p className='max-w-sm text-[0.875rem] text-muted'>
                Your session is still here. This is the server not answering, so nothing was lost —
                try again once it is back.
            </p>
        </div>

        <Button onPress={onRetry}>Try again</Button>
    </div>
);

export default ServerUnreachable;
