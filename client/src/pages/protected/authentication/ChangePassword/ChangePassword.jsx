import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Save } from 'lucide-react';
import { updateMyPassword } from '@services/authentication/operations';
import { useDocumentTitle } from '@hooks/common';
import { PageHeader } from '@components/atoms/kit';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PasswordInput from '@/components/ui/PasswordInput';

const ChangePassword = () => {
    const { error, loadingStatus } = useSelector((state) => state.auth);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [form, setForm] = useState({
        passwordCurrent: '',
        password: '',
        passwordConfirm: ''
    });
    useDocumentTitle('Change Password');

    const onChange = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

    const handleSubmit = (e) => {
        e.preventDefault();
        dispatch(updateMyPassword(form, navigate));
    };

    return (
        <div className='max-w-2xl'>
            <PageHeader
                title='Change password'
                subtitle='Update your password and improve the security of your account.'
            />

            {error && (
                <p className='mb-6 text-sm text-destructive'>
                    {String(error)}
                </p>
            )}

            <Card>
                <CardContent className='p-6'>
                    <form onSubmit={handleSubmit} className='flex flex-col gap-5'>
                        <div className='space-y-1.5'>
                            <label htmlFor='current-password' className='text-sm font-medium text-foreground'>
                                Current password
                            </label>
                            <PasswordInput
                                id='current-password'
                                name='passwordCurrent'
                                value={form.passwordCurrent}
                                onChange={onChange('passwordCurrent')}
                                required
                            />
                            <p className='text-xs text-muted-foreground'>
                                We need your current password to verify it is really you.
                            </p>
                        </div>
                        <div className='space-y-1.5'>
                            <label htmlFor='new-password' className='text-sm font-medium text-foreground'>
                                New password
                            </label>
                            <PasswordInput
                                id='new-password'
                                name='password'
                                value={form.password}
                                onChange={onChange('password')}
                                required
                            />
                        </div>
                        <div className='space-y-1.5'>
                            <label htmlFor='confirm-password' className='text-sm font-medium text-foreground'>
                                Confirm new password
                            </label>
                            <PasswordInput
                                id='confirm-password'
                                name='passwordConfirm'
                                value={form.passwordConfirm}
                                onChange={onChange('passwordConfirm')}
                                required
                            />
                        </div>
                        <div className='flex items-center gap-3 pt-1'>
                            <Button type='submit' disabled={loadingStatus.isOperationLoading}>
                                <Save className='h-4 w-4' />
                                {loadingStatus.isOperationLoading ? 'Saving changes…' : 'Save changes'}
                            </Button>
                            {!loadingStatus.isOperationLoading && (
                                <Link to='/auth/account'>
                                    <Button type='button' variant='ghost'>
                                        Cancel
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default ChangePassword;
