import { Button } from '@heroui/react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
    const navigate = useNavigate();

    return (
        <main className='screen-view dot-grid flex min-h-dvh items-center justify-center bg-background p-6'>
            <section className='flex w-full max-w-md flex-col items-start'>
                <p className='label-caps text-muted'>404</p>
                <h1 className='title-display mt-5 text-[2.75rem] leading-[1.02] text-foreground'>Page not found</h1>
                <p className='mt-4 text-sm text-muted'>
                    The page you are looking for doesn&apos;t exist or may have moved.
                </p>

                <Button className='mt-9' onPress={() => navigate('/applications')}>
                    Back to Applications
                    <ArrowRight aria-hidden='true' className='size-4' />
                </Button>
            </section>
        </main>
    );
};

export default NotFound;
