import { Button } from '@heroui/react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import type { Template } from '@quantum/contracts/modules/template/domain';

interface TemplateDetailProps{
    template: Template;
    onInstall: () => void;
}

interface FactProps{
    label: string;
    isIdentifier?: boolean;
    children: React.ReactNode;
}

const Fact = ({ label, isIdentifier = false, children }: FactProps) => (
    <div className='flex items-baseline justify-between gap-4 border-b border-separator py-3 last:border-0'>
        <span className='text-sm text-muted'>{label}</span>
        <span className={`text-right text-foreground ${isIdentifier ? 'font-mono text-[0.8125rem]' : 'text-sm'}`}>
            {children}
        </span>
    </div>
);

const Services = ({ template }: { template: Template }) => {
    const services = Object.entries(template.spec.services ?? {});
    if(services.length === 0) return null;

    return (
        <section className='mt-10 border-t border-border pt-5'>
            <div className='flex items-baseline justify-between gap-4'>
                <h3 className='text-[0.9375rem] font-medium text-foreground'>Services</h3>
                <span className='label-caps text-muted'>
                    {services.length} {services.length === 1 ? 'service' : 'services'}
                </span>
            </div>

            <div className='mt-2 flex flex-col'>
                {services.map(([name, service]) => (
                    <div key={name} className='flex items-center justify-between gap-4 border-b border-separator py-3 last:border-0'>
                        <span className='truncate font-mono text-[0.8125rem] text-foreground'>{name}</span>
                        <span className='truncate text-[0.8125rem] text-muted'>{service.image ?? service.engine ?? '—'}</span>
                    </div>
                ))}
            </div>
        </section>
    );
};

const TemplateDetail = ({ template, onInstall }: TemplateDetailProps) => (
    <div className='flex h-full flex-col overflow-y-auto px-5 py-8 sm:px-8 lg:px-12 lg:py-9'>
        <header>

            <h2 className='title-display text-[2.5rem] leading-[1.05] text-foreground'>{template.name}</h2>

            <p className='mt-4 max-w-[58ch] text-sm text-muted'>
                {template.description ?? 'No description provided.'}
            </p>

            <div className='mt-7 flex flex-wrap items-center gap-6'>
                <Button onPress={onInstall}>
                    Install
                    <ArrowRight aria-hidden='true' className='size-4' />
                </Button>

                {template.website && (
                    <a
                        href={template.website}
                        target='_blank'
                        rel='noreferrer'
                        className='label-caps inline-flex items-center gap-1.5 text-muted transition-colors hover:text-foreground'
                    >
                        Website
                        <ArrowUpRight aria-hidden='true' className='size-3.5' />
                    </a>
                )}
            </div>
        </header>

        <Services template={template} />

        <section className='mt-10 max-w-md border-t border-border pt-5'>
            <h3 className='text-[0.9375rem] font-medium text-foreground'>Details</h3>

            <div className='mt-2 flex flex-col'>
                <Fact label='Identifier' isIdentifier>{template.slug}</Fact>
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
