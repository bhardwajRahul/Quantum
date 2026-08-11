import { Building2 } from 'lucide-react';
import LoadingState from '@/shared/components/LoadingState';
import ErrorState from '@/shared/components/ErrorState';
import EmptyState from '@/shared/components/EmptyState';
import CreateOrganizationForm from '@/modules/organization/components/CreateOrganizationForm';
import { useTenancy } from '@/modules/organization/hooks/use-tenancy';
import { tenancyErrorMessages } from '@/modules/organization/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import type { ReactNode } from 'react';

const copy = errorCopy(tenancyErrorMessages);

interface OrgGateProps{
    children: ReactNode;
}

const OrgGate = ({ children }: OrgGateProps) => {
    const { organizations, loading, error, reload } = useTenancy();

    if(loading){
        return <LoadingState title='Preparing your workspace' description='Loading your organizations.' />;
    }

    if(error !== undefined){
        return (
            <ErrorState
                title='Could not load organizations'
                description={copy(error)}
                onRetry={reload}
            />
        );
    }

    if(organizations.length === 0){
        return (
            <EmptyState
                icon={Building2}
                title='Create an organization'
                description='Organizations hold your applications, projects and teammates. Create one to get started.'
            >
                <CreateOrganizationForm onCreated={reload} />
            </EmptyState>
        );
    }

    return <>{children}</>;
};

export default OrgGate;
