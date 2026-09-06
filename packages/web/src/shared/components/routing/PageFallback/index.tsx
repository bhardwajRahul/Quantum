import { Spinner } from '@heroui/react';

const PageFallback = () => (
    <div className='flex h-full items-center justify-center'>
        <Spinner color='current' className='text-muted' />
    </div>
);

export default PageFallback;
