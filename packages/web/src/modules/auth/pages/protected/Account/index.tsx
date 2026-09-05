import { Link as RouterLink } from 'react-router-dom';
import { useSession } from '@/modules/auth/hooks/use-session';
import PageBody from '@/shared/components/layout/PageBody';
import EmptyState from '@/shared/components/EmptyState';

const Account = () => {
    const { user } = useSession();

    if(user === null){
        return <EmptyState title='Loading your account' compact />;
    }

    return (
        <PageBody>
            <h1 className='text-lg font-medium text-foreground'>Account</h1>
            <p className='mt-1.5 text-sm text-muted'>Your profile on Quantum.</p>

            <dl className='mt-6 flex flex-col divide-y divide-border rounded-xl bg-foreground/[0.04]'>
                {[
                    ['Username', user.username],
                    ['Full name', user.fullname],
                    ['Email', user.email],
                    ['Role', user.role]
                ].map(([label, value]) => (
                    <div key={label} className='flex items-center justify-between gap-4 px-5 py-3.5'>
                        <dt className='text-[0.8125rem] text-muted'>{label}</dt>
                        <dd className='text-[0.875rem] text-foreground'>{value}</dd>
                    </div>
                ))}
            </dl>

            <RouterLink to='/change-password' className='mt-6 inline-block text-[0.875rem] text-foreground underline-offset-4 hover:underline'>
                Change password
            </RouterLink>
        </PageBody>
    );
};

export default Account;
