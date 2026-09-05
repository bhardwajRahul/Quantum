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
    Terminal,
    UserRound,
    Users
} from 'lucide-react';
import type { NavSection } from '@/shared/contracts/navigation';

export const sections: NavSection[] = [
    { label: 'Applications', to: '/applications', icon: AppWindow },
    { label: 'Projects', to: '/projects', icon: FolderClosed },
    { label: 'Domains', to: '/domains', icon: Globe },
    { label: 'Metrics', to: '/metrics', icon: Activity },
    { label: 'Templates', to: '/templates', icon: LayoutTemplate },
    { label: 'Analytics', to: '/web-analytics', icon: BarChart3 },
    { label: 'Usage', to: '/usage', icon: Gauge },
    { label: 'Codespaces', to: '/codespaces', icon: Terminal },
    { label: 'Events', to: '/events', icon: ScrollText }
];

/**
 * The sidebar becomes this while the reader is inside settings, rather than showing both
 * trees at once: settings is a place you go into and come back from, and the way back is
 * the first thing on the list.
 */
export const settingsSections: NavSection[] = [
    { label: 'Back to app', to: '/applications', icon: ArrowLeft },
    { label: 'Account', to: '/account', icon: UserRound },
    { label: 'Password', to: '/change-password', icon: KeyRound },
    { label: 'Organization', to: '/settings/organization', icon: Building2 },
    { label: 'Team', to: '/settings/team', icon: Users }
];

export const settingsEntry: NavSection = { label: 'Settings', to: '/settings/organization', icon: Settings };
