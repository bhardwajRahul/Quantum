import { useRef } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import ErrorState from '@/shared/components/ErrorState';
import EmptyState from '@/shared/components/EmptyState';
import CenterState from '@/shared/components/CenterState';
import EnvironmentVariablesEditor from '@/shared/components/EnvironmentVariablesEditor';
import { useQuery } from '@/shared/hooks/api/use-query';
import { templateInstallApi } from '@/modules/template/api/api';
import { templateErrorMessages } from '@/modules/template/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import type { ServiceEnvironment, TemplateInstall } from '@quantum/contracts/modules/template/domain';

const copy = errorCopy(templateErrorMessages);

const InstallEnvironment = () => {
    const { installId } = useParams<{ installId: string }>();
    const id = installId !== undefined ? Number(installId) : undefined;
    const install = useOutletContext<TemplateInstall>();
    const environment = useQuery((templateInstallId: number) => templateInstallApi.environment({ path: { id: templateInstallId } }), [id]);
    const overrides = useRef<ServiceEnvironment>(install.environment);

    if(id === undefined || environment.loading){
        return <CenterState className='h-full'><EmptyState title='Loading environment variables' loading compact /></CenterState>;
    }

    if(environment.error !== undefined || environment.data === null){
        return (
            <CenterState className='h-full'>
                <ErrorState
                    title='Could not load environment variables'
                    description={copy(environment.error ?? 'TemplateInstall::NotFound')}
                    onRetry={environment.reload}
                />
            </CenterState>
        );
    }

    const save = (service: string) => async (variables: Record<string, string>) => {
        const next = { ...overrides.current, [service]: variables };
        overrides.current = next;
        await templateInstallApi.updateEnvironment({ path: { id }, body: { environment: next } });
    };

    return (
        <div className='flex flex-col gap-10'>
            <p className='max-w-[58ch] text-[0.8125rem] text-muted'>
                One set of variables per service. Changes are saved automatically and applied the next time the
                services are redeployed.
            </p>

            {environment.data.services.map((service) => (
                <EnvironmentVariablesEditor
                    key={service.name}
                    title={service.name}
                    variables={service.environmentVariables}
                    save={save(service.name)}
                    getErrorMessage={copy}
                    description={`Environment of the ${service.name} container.`}
                    emptyDescription={`Add a variable to make it available to the ${service.name} container.`}
                    fills={false}
                />
            ))}
        </div>
    );
};

export default InstallEnvironment;
