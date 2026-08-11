export type SidebarPanelName = 'app' | 'settings';

export const panelFor = (pathname: string): SidebarPanelName => {
    if(pathname.startsWith('/settings')) return 'settings';

    return 'app';
};
