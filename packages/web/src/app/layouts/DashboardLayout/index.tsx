import { Outlet, useLocation } from 'react-router-dom';
import AppSidebar from '@/shared/components/layout/AppSidebar';
import { useResourceStream } from '@/shared/hooks/api/use-resource-stream';

const SETTINGS_PATHS = ['/settings', '/account', '/change-password'];

const panelFor = (pathname: string): 'app' | 'settings' =>
    SETTINGS_PATHS.some((path) => pathname.startsWith(path)) ? 'settings' : 'app';

const DashboardLayout = () => {
    const { pathname } = useLocation();
    const panel = panelFor(pathname);

    useResourceStream();

    return (
        <div className='flex h-dvh bg-background text-foreground' data-panel={panel}>
            <AppSidebar panel={panel} />

            <main className='page-view animate-enter min-w-0 flex-1 overflow-y-auto'>
                <Outlet />
            </main>
        </div>
    );
};

export default DashboardLayout;
