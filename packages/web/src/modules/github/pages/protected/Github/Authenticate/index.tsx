import { Navigate } from 'react-router-dom';
import PageBody from '@/shared/components/layout/PageBody';
import EmptyState from '@/shared/components/EmptyState';
import ErrorState from '@/shared/components/ErrorState';
import { useQuery } from '@/shared/hooks/api/use-query';
import { githubApi } from '@/modules/github/api/api';
import { githubErrorMessages } from '@/modules/github/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import { env } from '@/shared/config/env';
import { githubRoutes } from '@quantum/contracts/modules/github/routes';

const copy = errorCopy(githubErrorMessages);

const Authenticate = () => {
    const account = useQuery(githubApi.account, []);

    if(account.loading){
        return (
            <PageBody>
                <EmptyState title='Connecting to GitHub' compact />
            </PageBody>
        );
    }

    if(account.error !== undefined){
        return (
            <PageBody>
                <ErrorState
                    title='Could not connect to GitHub'
                    description={copy(account.error)}
                    onRetry={() => { window.location.href = `${env.apiUrl}${githubRoutes.oauthStart.path}`; }}
                />
            </PageBody>
        );
    }

    return <Navigate to='/dashboard' replace />;
};

export default Authenticate;
