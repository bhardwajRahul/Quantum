import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react';
import { useSession } from '@/modules/auth/hooks/use-session';
import PageBody from '@/shared/components/layout/PageBody';
import SettingsRow from '@/shared/components/SettingsRow';
import SettingsSection from '@/shared/components/SettingsSection';
import EmptyState from '@/shared/components/EmptyState';

const Account = () => {
    const { user } = useSession();
    // Above the early return: a hook called conditionally is a hook that breaks on the
    // render where the condition flips.
    const navigate = useNavigate();

    if(user === null){
        return <EmptyState title='Loading your account' compact />;
    }

    return (
        <PageBody>
            <h1 className='mb-6 text-2xl font-semibold text-foreground'>Account</h1>

            <div className='flex flex-col gap-8'>
                <SettingsSection title='Profile'>
                    <div className='rounded-2xl bg-foreground/[0.04] p-5'>
                        <dl className='flex flex-col divide-y divide-foreground/[0.06]'>
                            {[
                                ['Username', user.username],
                                ['Full name', user.fullname],
                                ['Email', user.email],
                                ['Role', user.role]
                            ].map(([label, value]) => (
                                <div key={label} className='flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0'>
                                    <dt className='text-[0.8125rem] text-muted'>{label}</dt>
                                    <dd className='text-[0.875rem] text-foreground'>{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </SettingsSection>

                <SettingsSection title='Security'>
                    <SettingsRow
                        title='Password'
                        description='Changing it needs the one you use today, so it stays behind a step.'
                        action={(
                            <Button variant='secondary' onPress={() => navigate('/change-password')}>
                                Change password
                            </Button>
                        )}
                    />
                </SettingsSection>
            </div>
        </PageBody>
    );
};

export default Account;
