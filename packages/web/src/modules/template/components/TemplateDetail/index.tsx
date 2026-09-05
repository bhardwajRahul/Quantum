import { Button, Chip } from '@heroui/react';
import { ExternalLink, Plus } from 'lucide-react';
import type { Template } from '@quantum/contracts/modules/template/domain';

interface TemplateDetailProps{
    template: Template;
    onInstall: () => void;
}

interface FactProps{
    label: string;
    children: React.ReactNode;
}

const Fact = ({ label, children }: FactProps) => (
    <div className='flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-0'>
        <span className='text-[0.8125rem] text-muted'>{label}</span>
        <span className='text-right text-[0.8125rem] text-foreground'>{children}</span>
    </div>
);

/**
 * The services a template installs, read from its own spec. This is the part worth
 * reading before installing anything — it says what will actually start running — and it
 * was not shown anywhere.
 */
const Services = ({ template }: { template: Template }) => {
    const services = Object.entries(template.spec.services ?? {});
    if(services.length === 0) return null;

    return (
        <section className='mt-8'>
            <h3 className='text-[0.9375rem] font-medium text-foreground'>Services</h3>

            <div className='mt-3 flex flex-col gap-2'>
                {services.map(([name, service]) => (
                    <div key={name} className='flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2'>
                        <span className='truncate font-medium text-foreground'>{name}</span>
                        <span className='truncate text-[0.8125rem] text-muted'>{service.image ?? service.engine ?? '—'}</span>
                    </div>
                ))}
            </div>
        </section>
    );
};

const TemplateDetail = ({ template, onInstall }: TemplateDetailProps) => (
    <div className='flex h-full flex-col overflow-y-auto px-6 py-5'>
        <header className='flex items-start gap-4'>
            <div className='min-w-0 flex-1'>
                <h2 className='text-lg font-medium text-foreground'>{template.name}</h2>

                <div className='mt-1.5 flex flex-wrap items-center gap-2'>
                    <Chip size='sm' variant='soft'>{template.category}</Chip>
                    <span className='text-[0.8125rem] text-muted'>v{template.version}</span>
                    {template.website && (
                        <a
                            href={template.website}
                            target='_blank'
                            rel='noreferrer'
                            className='inline-flex items-center gap-1 text-[0.8125rem] text-[var(--accent)] hover:underline'
                        >
                            Website
                            <ExternalLink aria-hidden='true' className='size-3.5' />
                        </a>
                    )}
                </div>
            </div>

            <Button onPress={onInstall}>
                <Plus aria-hidden='true' className='size-4' />
                Install
            </Button>
        </header>

        <p className='mt-5 max-w-2xl text-[0.875rem] leading-6 text-muted'>
            {template.description ?? 'No description provided.'}
        </p>

        <Services template={template} />

        <section className='mt-8 max-w-md'>
            <h3 className='text-[0.9375rem] font-medium text-foreground'>Details</h3>

            <div className='mt-2 flex flex-col'>
                <Fact label='Identifier'>{template.slug}</Fact>
                <Fact label='Version'>{template.version}</Fact>
                <Fact label='Category'>{template.category}</Fact>
                <Fact label='Source'>{template.source}</Fact>
                {template.inputsSchema.length > 0 && (
                    <Fact label='Asks for'>
                        {template.inputsSchema.length} {template.inputsSchema.length === 1 ? 'value' : 'values'}
                    </Fact>
                )}
            </div>
        </section>
    </div>
);

export default TemplateDetail;
