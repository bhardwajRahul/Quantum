import type { LucideIcon } from 'lucide-react';

export interface NavSection{
    label: string;
    to: string;
    icon: LucideIcon;
}

export interface NavGroup{
    heading?: string;
    items: NavSection[];
}
