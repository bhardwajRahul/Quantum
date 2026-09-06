import { ExternalLink } from 'lucide-react';
import type { RepositoryPort } from '@quantum/contracts/modules/repository/domain';

interface PublishedPortsProps{
    ports: RepositoryPort[];
}

const hostAddress = (externalPort: number): string => {
    const hostname = typeof window === 'undefined' ? 'localhost' : window.location.hostname;
    return `http://${hostname}:${externalPort}`;
};

const PublishedPorts = ({ ports }: PublishedPortsProps) => {
    if(ports.length === 0){
        return <span className='text-[0.8125rem] text-muted'>No published ports</span>;
    }

    return (
        <div className='flex flex-wrap items-center gap-x-3 gap-y-1.5'>
            {ports.map((port) => (
                <a
                    key={`${port.internalPort}/${port.externalPort}`}
                    href={hostAddress(port.externalPort)}
                    target='_blank'
                    rel='noreferrer'
                    className='inline-flex items-center gap-1.5 font-mono text-[0.8125rem] text-muted transition-colors hover:text-foreground motion-reduce:transition-none'
                >
                    <span>{hostAddress(port.externalPort)}</span>
                    <span className='text-muted'>&rarr; {port.internalPort}</span>
                    <ExternalLink aria-hidden='true' className='size-3.5 shrink-0' />
                </a>
            ))}
        </div>
    );
};

export default PublishedPorts;
