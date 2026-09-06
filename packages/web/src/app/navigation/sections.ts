import {
    Activity,
    AppWindow,
    ArrowLeft,
    BarChart3,
    Building2,
    FolderClosed,
    Gauge,
    Globe,
    KeyRound,
    LayoutTemplate,
    ScrollText,
    Settings,
    UserRound,
    Users
} from 'lucide-react';
import type { NavGroup, NavSection } from '@/shared/contracts/navigation';

export const navGroups: NavGroup[] = [
    {
        items: [
            { label: 'Applications', to: '/applications', icon: AppWindow },
            { label: 'Projects', to: '/projects', icon: FolderClosed },
            { label: 'Domains', to: '/domains', icon: Globe }
        ]
    },
    {
        heading: 'Observe',
        items: [
            { label: 'Metrics', to: '/metrics', icon: Activity },
            { label: 'Analytics', to: '/web-analytics', icon: BarChart3 },
            { label: 'Usage', to: '/usage', icon: Gauge },
            { label: 'Events', to: '/events', icon: ScrollText }
        ]
    },
    {
        heading: 'Catalogue',
        items: [
            { label: 'Templates', to: '/templates', icon: LayoutTemplate }
        ]
    }
];

export const sections: NavSection[] = navGroups.flatMap((group) => group.items);

export const settingsSections: NavSection[] = [
    { label: 'Back to app', to: '/applications', icon: ArrowLeft },
    { label: 'Account', to: '/account', icon: UserRound },
    { label: 'Password', to: '/change-password', icon: KeyRound },
    { label: 'Organization', to: '/settings/organization', icon: Building2 },
    { label: 'Team', to: '/settings/team', icon: Users }
];

export const settingsGroups: NavGroup[] = [{ items: settingsSections }];

export const settingsEntry: NavSection = { label: 'Settings', to: '/settings/organization', icon: Settings };
