import type { ReactNode } from 'react';

interface SettingsSectionProps{
    title: string;
    description?: string;
    children: ReactNode;
}

const SettingsSection = ({ title, description, children }: SettingsSectionProps) => (
    <section className='grid gap-6 border-t border-border py-8 lg:grid-cols-[17rem_minmax(0,48rem)] lg:gap-12'>
        <div>
            <h2 className='text-[1.0625rem] text-foreground'>{title}</h2>
            {description !== undefined && <p className='mt-2 max-w-[30ch] text-[0.8125rem] text-muted'>{description}</p>}
        </div>

        <div className='flex min-w-0 flex-col gap-5'>{children}</div>
    </section>
);

export default SettingsSection;
