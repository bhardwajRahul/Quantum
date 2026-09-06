import { NavLink, Outlet, useParams } from 'react-router-dom';
import { Button } from '@heroui/react';
import { ArrowUpRight, Play, RefreshCw, RotateCw, Square } from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import EmptyState from '@/shared/components/EmptyState';
import ErrorState from '@/shared/components/ErrorState';
import CenterState from '@/shared/components/CenterState';
import StatusDot from '@/shared/components/StatusDot';
import InlineError from '@/shared/components/InlineError';
import WorkspaceButton from '@/modules/codespace/components/WorkspaceButton';
import { useQuery } from '@/shared/hooks/api/use-query';
import { usePolledQuery } from '@/shared/hooks/api/use-polled-query';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { templateInstallApi } from '@/modules/template/api/api';
import { installStatusColor, installStatusLabel, isInstallRunning, isInstallTransient } from '@/modules/template/utils/install-status';
import { templateErrorMessages } from '@/modules/template/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import type { TemplateInstall, TemplateInstallService } from '@quantum/contracts/modules/template/domain';
import type { TemplateInstallOperation } from '@quantum/contracts/modules/template/http';

const copy = errorCopy(templateErrorMessages);

const TABS = [
    { label: 'Logs', to: 'logs' },
    { label: 'Shell', to: 'shell' },
    { label: 'Environment', to: 'environment' }
] as const;

const COMPOSE_TAB = { label: 'Compose', to: 'compose' } as const;

const tabsFor = (install: TemplateInstall) => (install.compose === null ? TABS : [...TABS, COMPOSE_TAB]);

const kindLabel = (install: TemplateInstall): string => (install.compose === null ? 'Template' : 'Docker Compose');

const tabClass = (active: boolean): string =>
    `label-caps -mb-px shrink-0 whitespace-nowrap border-b pb-3.5 transition-colors focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-foreground motion-reduce:transition-none ${
        active ? 'border-foreground text-foreground' : 'border-transparent text-muted hover:text-foreground'
    }`;

const hostAddress = (externalPort: number): string =>
    `http://${typeof window === 'undefined' ? 'localhost' : window.location.hostname}:${externalPort}`;

interface ServicesProps{
    services: TemplateInstallService[];
}

const Services = ({ services }: ServicesProps) => (
    <ul className='mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-[0.8125rem] text-muted'>
        {services.map((service) => (
            <li key={service.name} className='flex items-center gap-2'>
                <span className='text-foreground'>{service.name}</span>
                <span className='font-mono'>{service.image}</span>
                {service.ports.map((port) => (
                    <a
                        key={`${port.internalPort}/${port.protocol}`}
                        href={hostAddress(port.externalPort)}
                        target='_blank'
                        rel='noreferrer'
                        className='inline-flex items-center gap-1 font-mono transition-colors hover:text-foreground motion-reduce:transition-none'
                    >
                        :{port.externalPort} → {port.internalPort}
                        <ArrowUpRight aria-hidden='true' className='size-3.5' />
                    </a>
                ))}
            </li>
        ))}
    </ul>
);

interface InstallHeaderProps{
    install: TemplateInstall;
    isOperating: boolean;
    isRedeploying: boolean;
    redeployError: Error | undefined;
    onOperate: (operation: TemplateInstallOperation) => void;
    onRedeploy: () => void;
}

const InstallHeader = ({ install, isOperating, isRedeploying, redeployError, onOperate, onRedeploy }: InstallHeaderProps) => {
    const running = isInstallRunning(install.status);
    const busy = isOperating || isInstallTransient(install.status);

    return (
        <header className='flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between'>
            <div className='min-w-0'>
                <p className='label-caps flex items-center gap-2 text-muted'>
                    <NavLink to={`/applications?project=${install.projectId}`} className='transition-colors hover:text-foreground motion-reduce:transition-none'>
                        Applications
                    </NavLink>
                    <span aria-hidden='true'>/</span>
                    <span className='truncate text-foreground/70'>{install.name}</span>
                </p>

                <h1 className='title-display mt-4 truncate text-[2.125rem] leading-[1.1] text-foreground'>{install.name}</h1>

                <div className='mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted'>
                    <StatusDot
                        color={installStatusColor(install.status)}
                        label={installStatusLabel(install.status)}
                        isTransient={isInstallTransient(install.status)}
                    />
                    <span>· {kindLabel(install)} · {install.services.length} {install.services.length === 1 ? 'service' : 'services'}</span>
                </div>

                {install.services.length > 0 && <Services services={install.services} />}
            </div>

            <div className='flex shrink-0 flex-col gap-2 lg:items-end'>
                <div className='flex flex-wrap gap-2'>
                    <WorkspaceButton target={{ kind: 'install', id: install.id }} />
                    <Button variant='secondary' isDisabled={running || busy} onPress={() => onOperate('start')}>
                        <Play aria-hidden='true' className='size-4' />
                        Start
                    </Button>
                    <Button variant='secondary' isDisabled={!running || busy} onPress={() => onOperate('stop')}>
                        <Square aria-hidden='true' className='size-4' />
                        Stop
                    </Button>
                    <Button variant='secondary' isDisabled={busy} onPress={() => onOperate('restart')}>
                        <RotateCw aria-hidden='true' className='size-4' />
                        Restart
                    </Button>
                    <Button variant='secondary' isDisabled={busy} isPending={isRedeploying} onPress={onRedeploy}>
                        <RefreshCw aria-hidden='true' className='size-4' />
                        Redeploy
                    </Button>
                </div>
                {redeployError !== undefined && <InlineError>{copy(redeployError)}</InlineError>}
            </div>
        </header>
    );
};

const InstallLayout = () => {
    const { installId } = useParams<{ installId: string }>();
    const id = installId !== undefined ? Number(installId) : undefined;

    const query = useQuery((templateInstallId: number) => templateInstallApi.get({ path: { id: templateInstallId } }), [id]);
    const install = usePolledQuery(query, { while: (data) => isInstallTransient(data.status), everyMs: 4000 });

    const operate = useMutation((templateInstallId: number, operation: TemplateInstallOperation) =>
        templateInstallApi.operate({ path: { id: templateInstallId }, body: { operation } }), {
        onSuccess: () => install.reload()
    });
    const redeploy = useMutation((templateInstallId: number) => templateInstallApi.redeploy({ path: { id: templateInstallId } }), {
        onSuccess: () => install.reload()
    });

    if(install.loading){
        return (
            <PageBody width='wide' height='full'>
                <CenterState className='h-full'>
                    <EmptyState title='Loading install' loading compact />
                </CenterState>
            </PageBody>
        );
    }

    if(install.error !== undefined){
        return (
            <PageBody width='wide'>
                <ErrorState title='Could not load the install' description={copy(install.error)} onRetry={install.reload} />
            </PageBody>
        );
    }

    if(install.data === null || id === undefined) return null;

    return (
        <PageBody width='wide' height='full'>
            <InstallHeader
                install={install.data}
                isOperating={operate.loading}
                isRedeploying={redeploy.loading}
                redeployError={redeploy.error}
                onOperate={(operation) => { void operate.run(id, operation).catch(() => undefined); }}
                onRedeploy={() => { void redeploy.run(id).catch(() => undefined); }}
            />

            <nav aria-label='Install' className='mt-8 flex shrink-0 gap-8 overflow-x-auto border-b border-border'>
                {tabsFor(install.data).map((tab) => (
                    <NavLink key={tab.to} to={tab.to} className={({ isActive }) => tabClass(isActive)}>
                        {tab.label}
                    </NavLink>
                ))}
            </nav>

            <div className='flex min-h-0 flex-1 flex-col pt-8'>
                <Outlet context={install.data} />
            </div>
        </PageBody>
    );
};

export default InstallLayout;
