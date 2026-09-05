import { Link as RouterLink } from 'react-router-dom';
import PageBody from '@/shared/components/layout/PageBody';
import ConnectGithubButton from '@/modules/github/components/ConnectGithubButton';

const NeedAuthenticate = () => (
    <PageBody>
        <h1 className='text-lg font-medium text-foreground'>Connect GitHub</h1>
        <p className='mt-1.5 text-sm text-muted'>
            Connect your GitHub account to import and deploy repositories.
        </p>

        <div className='mt-6 flex items-center gap-4'>
            <ConnectGithubButton />

            <RouterLink to='/dashboard' className='text-sm text-muted'>Skip for now</RouterLink>
        </div>
    </PageBody>
);

export default NeedAuthenticate;
