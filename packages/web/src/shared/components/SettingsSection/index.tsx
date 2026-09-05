import type { ReactNode } from 'react';

interface SettingsSectionProps{
    title: string;
    children: ReactNode;
}

const SettingsSection = ({ title, children }: SettingsSectionProps) => (
    <section className='flex flex-col gap-3'>
        <h2 className='text-[0.9375rem] font-medium text-foreground'>{title}</h2>
        {children}
    </section>
);

export default SettingsSection;
