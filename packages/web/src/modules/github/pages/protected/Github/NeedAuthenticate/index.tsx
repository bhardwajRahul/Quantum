import { Button } from '@heroui/react';
import { Link as RouterLink } from 'react-router-dom';
import PageBody from '@/shared/components/layout/PageBody';
import { env } from '@/shared/config/env';
import { githubRoutes } from '@quantum/contracts/modules/github/routes';

const NeedAuthenticate = () => (
    <PageBody>
        <h1 className='text-lg font-medium text-foreground'>Connect GitHub</h1>
        <p className='mt-1.5 text-sm text-muted'>
            Connect your GitHub account to import and deploy repositories.
        </p>

        <div className='mt-6 flex items-center gap-4'>
            <Button onPress={() => { window.location.href = `${env.apiUrl}${githubRoutes.oauthStart.path}`; }}>
                Connect GitHub
            </Button>

            <RouterLink to='/dashboard' className='text-sm text-muted'>Skip for now</RouterLink>
        </div>
    </PageBody>
);

export default NeedAuthenticate;
