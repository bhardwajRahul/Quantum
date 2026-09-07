import { useOutletContext } from 'react-router-dom';
import { Table } from '@heroui/react';
import { ArrowUpRight, Layers } from 'lucide-react';
import EmptyState from '@/shared/components/EmptyState';
import CenterState from '@/shared/components/CenterState';
import InternalAddress from '@/shared/components/InternalAddress';
import DeploymentProgress from '@/modules/template/components/DeploymentProgress';
import { isInstallTransient } from '@/modules/template/utils/install-status';
import { portUrl, usePublicHost } from '@/shared/hooks/use-public-host';
import { TemplateInstallStatus } from '@quantum/contracts/modules/template/domain';
import type { TemplateInstall, TemplateInstallService } from '@quantum/contracts/modules/template/domain';

interface PublishedPortsProps{
    host: string;
    service: TemplateInstallService;
}

const PublishedPorts = ({ host, service }: PublishedPortsProps) => {
    if(service.ports.length === 0){
        return <span className='text-[0.8125rem] text-muted'>Internal only</span>;
    }

    return (
        <div className='flex flex-wrap items-center gap-x-4 gap-y-1'>
            {service.ports.map((port) => (
                <a
                    key={`${port.internalPort}/${port.protocol}`}
                    href={portUrl(host, port.externalPort)}
                    target='_blank'
                    rel='noreferrer'
                    className='inline-flex items-center gap-1 font-mono text-[0.8125rem] text-muted transition-colors hover:text-foreground motion-reduce:transition-none'
                >
                    {host}:{port.externalPort}
                    <span className='text-muted/70'>&rarr; {port.internalPort}</span>
                    <ArrowUpRight aria-hidden='true' className='size-3.5' />
                </a>
            ))}
        </div>
    );
};

const InstallServices = () => {
    const install = useOutletContext<TemplateInstall>();
    const host = usePublicHost();

    const deploying = isInstallTransient(install.status);
    const showProgress = deploying || install.status === TemplateInstallStatus.Error;

    if(install.services.length === 0){
        return (
            <div className='flex flex-col gap-10'>
                {showProgress && <DeploymentProgress installId={install.id} active={deploying} />}
                {!deploying && (
                    <CenterState className='h-full'>
                        <EmptyState
                            icon={Layers}
                            title='No services yet'
                            description='The services of this stack appear here once it has been provisioned.'
                            compact
                        />
                    </CenterState>
                )}
            </div>
        );
    }

    return (
        <div className='flex flex-col gap-10'>
        {showProgress && <DeploymentProgress installId={install.id} active={deploying} />}
        <Table>
            <Table.ScrollContainer>
                <Table.Content aria-label='Services'>
                    <Table.Header>
                        <Table.Column isRowHeader>Service</Table.Column>
                        <Table.Column>Image</Table.Column>
                        <Table.Column>Address</Table.Column>
                        <Table.Column>Published ports</Table.Column>
                    </Table.Header>

                    <Table.Body>
                        {install.services.map((service) => (
                            <Table.Row key={service.name}>
                                <Table.Cell>
                                    <span className='font-medium text-foreground'>{service.name}</span>
                                </Table.Cell>
                                <Table.Cell>
                                    <code className='font-mono text-[0.8125rem] text-muted'>{service.image}</code>
                                </Table.Cell>
                                <Table.Cell>
                                    <InternalAddress address={service.address} />
                                </Table.Cell>
                                <Table.Cell>
                                    <PublishedPorts host={host} service={service} />
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table.Content>
            </Table.ScrollContainer>
        </Table>
        </div>
    );
};

export default InstallServices;
