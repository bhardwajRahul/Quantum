import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Github } from 'lucide-react';
import { authenticate } from '@services/github/operations';
import { useDocumentTitle } from '@hooks/common';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const NeedAuthenticate = () => {
    const { isLoading } = useSelector((state) => state.github);
    const { user } = useSelector((state) => state.auth);
    const navigate = useNavigate();
    useDocumentTitle('Github Authentication');

    useEffect(() => {
        if(user?.github?._id) navigate('/dashboard');
    }, [user?.github?._id, navigate]);

    return (
        <div className='max-w-xl'>
            <Card>
                <CardContent className='p-8'>
                    <div className='mb-6'>
                        <div className='mb-4 grid place-items-center h-12 w-12 rounded-xl bg-primary/10 text-primary'>
                            <Github className='h-6 w-6' />
                        </div>
                        <h1 className='text-xl font-semibold text-foreground'>
                            Connect your GitHub account
                        </h1>
                        <p className='mt-2 text-sm text-muted-foreground'>
                            Link your GitHub account to deploy your repositories and unlock the
                            full Quantum experience. This step is optional, you can connect later.
                        </p>
                    </div>

                    {isLoading ? (
                        <div className='flex items-center gap-3 text-muted-foreground'>
                            <span className='h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                            <span className='text-sm'>Connecting to your GitHub account…</span>
                        </div>
                    ) : (
                        <div className='flex flex-col gap-4 items-start'>
                            <Button onClick={() => authenticate(user._id)}>
                                <Github className='h-4 w-4' /> Connect GitHub
                            </Button>
                            <Link to='/dashboard' className='font-medium text-primary hover:underline'>
                                Skip for now
                            </Link>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default NeedAuthenticate;
