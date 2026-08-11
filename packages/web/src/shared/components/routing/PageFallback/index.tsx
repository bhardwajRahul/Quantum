import { LoaderCircle } from 'lucide-react';

const PageFallback = () => (
    <div className='flex h-full items-center justify-center'>
        <LoaderCircle className='size-6 animate-spin text-muted' aria-label='Loading' />
    </div>
);

export default PageFallback;
