import type { TemplateInstallService } from '@quantum/contracts/modules/template/domain';

interface ServicePickerProps{
    services: TemplateInstallService[];
    value: string;
    onChange: (name: string) => void;
}

const ServicePicker = ({ services, value, onChange }: ServicePickerProps) => {
    if(services.length < 2) return null;

    return (
        <div role='group' aria-label='Service' className='inline-flex h-9 self-start border border-border'>
            {services.map((service, index) => (
                <button
                    key={service.name}
                    type='button'
                    aria-pressed={service.name === value}
                    onClick={() => onChange(service.name)}
                    className={`label-caps px-3.5 transition-colors motion-reduce:transition-none ${index > 0 ? 'border-l border-border' : ''} ${
                        service.name === value ? 'bg-foreground text-background' : 'text-muted hover:text-foreground'
                    }`}
                >
                    {service.name}
                </button>
            ))}
        </div>
    );
};

export default ServicePicker;
