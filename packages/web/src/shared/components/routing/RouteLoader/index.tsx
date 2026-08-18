import { Spinner } from '@heroui/react';

const RouteLoader = () => (
    <div className='flex min-h-dvh items-center justify-center bg-background'>
        <Spinner color='current' className='text-muted' />
    </div>
);

export default RouteLoader;
