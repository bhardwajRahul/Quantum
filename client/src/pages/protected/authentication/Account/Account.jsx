import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Save, KeyRound, Trash2 } from 'lucide-react';
import { getMyProfile, updateMyProfile, deleteMyProfile } from '@services/authentication/operations';
import { useDocumentTitle } from '@hooks/common';
import { PageHeader, ConfirmDialog } from '@components/atoms/kit';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const AccountPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user, error, loadingStatus, authStatus } = useSelector((state) => state.auth);
    const [form, setForm] = useState({ username: '', fullname: '', email: '' });
    const [confirmOpen, setConfirmOpen] = useState(false);
    useDocumentTitle('My Account');

    useEffect(() => {
        dispatch(getMyProfile());
    }, [dispatch]);

    useEffect(() => {
        setForm({
            username: user?.username || '',
            fullname: user?.fullname || '',
            email: user?.email || ''
        });
    }, [user?.username, user?.fullname, user?.email]);

    const onChange = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

    const handleSubmit = (e) => {
        e.preventDefault();
        dispatch(updateMyProfile(form, navigate));
    };

    const handleDelete = () => {
        setConfirmOpen(false);
        dispatch(deleteMyProfile());
    };

    return (
        <div className='max-w-2xl'>
            <PageHeader
                title='Account'
                subtitle='Manage your Quantum profile and account settings.'
            />

            {error && (
                <p className='mb-6 text-sm text-destructive'>
                    {String(error)}
                </p>
            )}

            <div className='flex flex-col gap-6'>
                <Card>
                    <CardContent className='p-6'>
                        <form onSubmit={handleSubmit} className='flex flex-col gap-5'>
                            <h2 className='text-lg font-semibold text-foreground'>Profile</h2>
                            <div className='space-y-1.5'>
                                <label htmlFor='account-fullname' className='text-sm font-medium text-foreground'>
                                    Full name
                                </label>
                                <Input
                                    id='account-fullname'
                                    name='fullname'
                                    value={form.fullname}
                                    onChange={onChange('fullname')}
                                />
                            </div>
                            <div className='space-y-1.5'>
                                <label htmlFor='account-username' className='text-sm font-medium text-foreground'>
                                    Username
                                </label>
                                <Input
                                    id='account-username'
                                    name='username'
                                    value={form.username}
                                    onChange={onChange('username')}
                                />
                            </div>
                            <div className='space-y-1.5'>
                                <label htmlFor='account-email' className='text-sm font-medium text-foreground'>
                                    Email address
                                </label>
                                <Input
                                    id='account-email'
                                    name='email'
                                    type='email'
                                    value={form.email}
                                    onChange={onChange('email')}
                                />
                            </div>
                            <div className='pt-1'>
                                <Button type='submit' disabled={loadingStatus.isOperationLoading}>
                                    <Save className='h-4 w-4' />
                                    {loadingStatus.isOperationLoading ? 'Saving changes…' : 'Save changes'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className='p-6 flex flex-col gap-4 items-start'>
                        <h2 className='text-lg font-semibold text-foreground'>Security</h2>
                        <p className='text-sm text-muted-foreground'>
                            Update your password to keep your account secure.
                        </p>
                        <Link to='/auth/account/change-password'>
                            <Button variant='outline'>
                                <KeyRound className='h-4 w-4' /> Change password
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card className='border-destructive/50'>
                    <CardContent className='p-6 flex flex-col gap-4 items-start'>
                        <h2 className='text-lg font-semibold text-destructive'>Danger zone</h2>
                        <p className='text-sm text-muted-foreground'>
                            Permanently delete your account and all associated data. This action cannot be undone.
                        </p>
                        <Button
                            variant='destructive'
                            disabled={authStatus.isEliminatingAccount}
                            onClick={() => setConfirmOpen(true)}
                        >
                            <Trash2 className='h-4 w-4' /> Delete account
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <ConfirmDialog
                open={confirmOpen}
                onCancel={() => setConfirmOpen(false)}
                onConfirm={handleDelete}
                title='Delete account'
                description='Are you sure you want to delete your account? All of your applications, deployments and data will be permanently removed. This action cannot be undone.'
                confirmLabel='Delete account'
                destructive
            />
        </div>
    );
};

export default AccountPage;
