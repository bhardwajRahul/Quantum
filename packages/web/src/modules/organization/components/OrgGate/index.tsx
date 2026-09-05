import { Building2 } from 'lucide-react';
import ErrorState from '@/shared/components/ErrorState';
import EmptyState from '@/shared/components/EmptyState';
import CenterState from '@/shared/components/CenterState';
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
        return (
            <CenterState className='h-full'>
                <EmptyState title='Preparing your workspace' description='Loading your organizations.' />
            </CenterState>
        );
    }

    if(error !== undefined){
        return (
            <CenterState className='h-full'>
                <ErrorState
                    title='Could not load organizations'
                    description={copy(error)}
                    onRetry={reload}
                />
            </CenterState>
        );
    }

    if(organizations.length === 0){
        return (
            <CenterState className='h-full'>
                <EmptyState
                    icon={Building2}
                    title='Create an organization'
                    description='Organizations hold your applications, projects and teammates. Create one to get started.'
                >
                    <CreateOrganizationForm onCreated={reload} />
                </EmptyState>
            </CenterState>
        );
    }

    return <>{children}</>;
};

export default OrgGate;
