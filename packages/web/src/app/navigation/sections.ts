import {
    Activity,
    AppWindow,
    BarChart3,
    FolderClosed,
    Gauge,
    Globe,
    LayoutDashboard,
    LayoutTemplate,
    ScrollText,
    Settings,
    Terminal
} from 'lucide-react';
import type { NavSection } from '@/shared/contracts/navigation';

export const sections: NavSection[] = [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Applications', to: '/applications', icon: AppWindow },
    { label: 'Projects', to: '/projects', icon: FolderClosed },
    { label: 'Domains', to: '/domains', icon: Globe },
    { label: 'Metrics', to: '/metrics', icon: Activity },
    { label: 'Templates', to: '/templates', icon: LayoutTemplate },
    { label: 'Analytics', to: '/web-analytics', icon: BarChart3 },
    { label: 'Usage', to: '/usage', icon: Gauge },
    { label: 'Codespaces', to: '/codespaces', icon: Terminal },
    { label: 'Events', to: '/events', icon: ScrollText },
    { label: 'Settings', to: '/settings/organization', icon: Settings }
];
