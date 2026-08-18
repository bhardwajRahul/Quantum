import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { ArrowRight } from 'lucide-react';
import { signUp } from '@services/authentication/operations';
import { useDocumentTitle } from '@hooks/common';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PasswordInput from '@/components/ui/PasswordInput';

const SignUp = () => {
    const { loadingStatus, authStatus, error } = useSelector((state) => state.auth);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [form, setForm] = useState({
        username: '',
        fullname: '',
        email: '',
        password: '',
        passwordConfirm: ''
    });
    useDocumentTitle('Sign Up');

    useEffect(() => {
        if(authStatus.isAuthenticated) navigate('/dashboard');
    }, [authStatus.isAuthenticated, navigate]);

    const onChange = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

    const handleSubmit = (e) => {
        e.preventDefault();
        dispatch(signUp(form));
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
                            Create your account
                        </h1>
                        <p className='mt-1 text-sm text-muted-foreground'>
                            All your applications, just in one place.
                        </p>
                    </div>

                    {error && (
                        <p className='mb-6 text-sm text-destructive'>
                            {String(error)}
                        </p>
                    )}

                    <form onSubmit={handleSubmit} className='flex flex-col gap-5'>
                        <div className='space-y-1.5'>
                            <label htmlFor='signup-username' className='text-sm font-medium text-foreground'>
                                Username
                            </label>
                            <Input
                                id='signup-username'
                                name='username'
                                value={form.username}
                                onChange={onChange('username')}
                                required
                            />
                        </div>
                        <div className='space-y-1.5'>
                            <label htmlFor='signup-fullname' className='text-sm font-medium text-foreground'>
                                Full name
                            </label>
                            <Input
                                id='signup-fullname'
                                name='fullname'
                                value={form.fullname}
                                onChange={onChange('fullname')}
                                required
                            />
                        </div>
                        <div className='space-y-1.5'>
                            <label htmlFor='signup-email' className='text-sm font-medium text-foreground'>
                                Email address
                            </label>
                            <Input
                                id='signup-email'
                                name='email'
                                type='email'
                                value={form.email}
                                onChange={onChange('email')}
                                required
                            />
                        </div>
                        <div className='space-y-1.5'>
                            <label htmlFor='signup-password' className='text-sm font-medium text-foreground'>
                                Password
                            </label>
                            <PasswordInput
                                id='signup-password'
                                name='password'
                                value={form.password}
                                onChange={onChange('password')}
                                required
                            />
                        </div>
                        <div className='space-y-1.5'>
                            <label htmlFor='signup-password-confirm' className='text-sm font-medium text-foreground'>
                                Confirm password
                            </label>
                            <PasswordInput
                                id='signup-password-confirm'
                                name='passwordConfirm'
                                value={form.passwordConfirm}
                                onChange={onChange('passwordConfirm')}
                                required
                            />
                        </div>
                        <Button type='submit' disabled={loadingStatus.isLoading} className='w-full'>
                            {loadingStatus.isLoading ? 'Creating account…' : 'Create account'}
                            <ArrowRight className='h-4 w-4' />
                        </Button>
                    </form>

                    <p className='mt-6 text-sm text-muted-foreground'>
                        Already have an account?{' '}
                        <Link to='/auth/sign-in' className='font-medium text-primary hover:underline'>
                            Sign in
                        </Link>
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};

export default SignUp;
