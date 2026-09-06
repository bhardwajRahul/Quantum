import { useRef, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Button } from '@heroui/react';
import { RotateCw } from 'lucide-react';
import ErrorState from '@/shared/components/ErrorState';
import EmptyState from '@/shared/components/EmptyState';
import CenterState from '@/shared/components/CenterState';
import InlineError from '@/shared/components/InlineError';
import EnvironmentVariablesEditor from '@/shared/components/EnvironmentVariablesEditor';
import { useQuery } from '@/shared/hooks/api/use-query';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { templateInstallApi } from '@/modules/template/api/api';
import { templateErrorMessages } from '@/modules/template/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import type { ServiceEnvironment, TemplateInstall } from '@quantum/contracts/modules/template/domain';

const copy = errorCopy(templateErrorMessages);

interface RedeployButtonProps{
    installId: number;
    onQueued: () => void;
    onSettled: (error: Error | undefined) => void;
}

const RedeployButton = ({ installId, onQueued, onSettled }: RedeployButtonProps) => {
    const redeploy = useMutation(() => templateInstallApi.redeploy({ path: { id: installId } }), { onSuccess: onQueued });

    const handlePress = () => {
        void redeploy.run().then(() => onSettled(undefined), (error: unknown) => onSettled(error instanceof Error ? error : undefined));
    };

    return (
        <Button variant='secondary' isPending={redeploy.loading} onPress={handlePress}>
            <RotateCw aria-hidden='true' className='size-4' />
            Redeploy
        </Button>
    );
};

const InstallEnvironment = () => {
    const { installId } = useParams<{ installId: string }>();
    const id = installId !== undefined ? Number(installId) : undefined;
    const install = useOutletContext<TemplateInstall>();
    const environment = useQuery((templateInstallId: number) => templateInstallApi.environment({ path: { id: templateInstallId } }), [id]);
    const overrides = useRef<ServiceEnvironment>(install.environment);
    const [redeployError, setRedeployError] = useState<Error | undefined>(undefined);

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
            <div className='flex flex-wrap items-center justify-between gap-4'>
                <p className='max-w-[58ch] text-[0.8125rem] text-muted'>
                    One set of variables per service. Changes are saved automatically and applied the next time the
                    services are redeployed.
                </p>
                <RedeployButton installId={id} onQueued={environment.reload} onSettled={setRedeployError} />
            </div>

            {redeployError !== undefined && <InlineError>{copy(redeployError)}</InlineError>}

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
