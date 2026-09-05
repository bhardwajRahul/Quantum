import { Navigate } from 'react-router-dom';
import PageBody from '@/shared/components/layout/PageBody';
import EmptyState from '@/shared/components/EmptyState';
import ErrorState from '@/shared/components/ErrorState';
import { useQuery } from '@/shared/hooks/api/use-query';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { githubApi } from '@/modules/github/api/api';
import { githubErrorMessages } from '@/modules/github/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';

const copy = errorCopy(githubErrorMessages);

const Authenticate = () => {
    const account = useQuery(githubApi.account, []);
    const restart = useMutation(githubApi.oauthStart, {
        onSuccess: ({ url }) => { window.location.href = url; }
    });

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
                    onRetry={() => { void restart.run().catch(() => undefined); }}
                />
            </PageBody>
        );
    }

    return <Navigate to='/applications' replace />;
};

export default Authenticate;
