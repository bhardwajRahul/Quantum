import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { LogIn } from 'lucide-react';
import { signIn } from '@services/authentication/operations';
import { useDocumentTitle } from '@hooks/common';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PasswordInput from '@/components/ui/PasswordInput';

const SignIn = () => {
    const { loadingStatus, authStatus, error } = useSelector((state) => state.auth);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    useDocumentTitle('Sign In');

    useEffect(() => {
        if(authStatus.isAuthenticated) navigate('/dashboard');
    }, [authStatus.isAuthenticated, navigate]);

    const handleSubmit = (e) => {
        e.preventDefault();
        dispatch(signIn({ email, password }));
    };

    return (
        <div className='min-h-screen grid place-items-center bg-background px-4 py-8'>
            <Card className='w-full max-w-md'>
                <CardContent className='p-8'>
                    <div className='mb-8'>
                        <p className='text-xs font-semibold uppercase tracking-[0.2em] text-primary'>
                            Quantum
                        </p>
                        <h1 className='mt-3 text-2xl font-semibold tracking-tight text-foreground'>
                            Welcome back
                        </h1>
                        <p className='mt-1 text-sm text-muted-foreground'>
                            Sign in to your Quantum account.
                        </p>
                    </div>

                    {error && (
                        <p className='mb-6 text-sm text-destructive'>
                            {String(error)}
                        </p>
                    )}

                    <form onSubmit={handleSubmit} className='flex flex-col gap-5'>
                        <div className='space-y-1.5'>
                            <label htmlFor='signin-email' className='text-sm font-medium text-foreground'>
                                Email address
                            </label>
                            <Input
                                id='signin-email'
                                name='email'
                                type='email'
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className='space-y-1.5'>
                            <label htmlFor='signin-password' className='text-sm font-medium text-foreground'>
                                Password
                            </label>
                            <PasswordInput
                                id='signin-password'
                                name='password'
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <Button type='submit' disabled={loadingStatus.isLoading} className='w-full'>
                            <LogIn className='h-4 w-4' />
                            {loadingStatus.isLoading ? 'Signing in…' : 'Sign in'}
                        </Button>
                    </form>

                    <p className='mt-6 text-sm text-muted-foreground'>
                        Don't have an account?{' '}
                        <Link to='/auth/sign-up' className='font-medium text-primary hover:underline'>
                            Create one
                        </Link>
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};

export default SignIn;
