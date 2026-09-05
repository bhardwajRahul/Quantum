import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { sections } from '@/app/navigation/sections';
import { endSession } from '@/shared/services/end-session';
import OrganizationSwitcher from '@/modules/organization/components/OrganizationSwitcher';
import ThemeToggle from '@/shared/components/layout/ThemeToggle';
import SessionAvatar from '@/modules/auth/components/SessionAvatar';

const panelFor = (pathname: string): 'app' | 'settings' => {
    if(pathname.startsWith('/settings')) return 'settings';

    return 'app';
};

const navItemClass = (active: boolean): string =>
    `flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[0.875rem] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground motion-reduce:transition-none ${
        active ? 'font-medium text-foreground' : 'text-muted hover:text-foreground'
    }`;

const DashboardLayout = () => {
    const { pathname } = useLocation();
    const panel = panelFor(pathname);

    const signOut = () => {
        void endSession();
    };

    return (
        <div className='flex h-dvh bg-background text-foreground' data-panel={panel}>
            <aside className='app-sidebar hidden shrink-0 flex-col overflow-hidden lg:flex'>
                <nav aria-label='Main' className='flex flex-1 flex-col gap-0.5 px-3 pb-3 pt-5'>
                    {sections.map(({ label, to, icon: Icon }) => (
                        <NavLink key={to} to={to} className={({ isActive }) => navItemClass(isActive)}>
                            <Icon className='size-[18px] shrink-0' aria-hidden='true' />
                            <span className='truncate'>{label}</span>
                        </NavLink>
                    ))}

                    <span className='flex-1' />

                    <button type='button' onClick={signOut} className={navItemClass(false)}>
                        <LogOut className='size-[18px] shrink-0' aria-hidden='true' />
                        <span className='truncate'>Sign out</span>
                    </button>
                </nav>
            </aside>

            <div className='chrome-frame flex min-w-0 flex-1'>
                <div className='chrome-surface flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--dashboard-surface)]'>
                    <header className='flex h-[var(--app-header-height)] shrink-0 items-center justify-between gap-4 px-6'>
                        <OrganizationSwitcher />

                        <div className='flex shrink-0 items-center gap-2'>
                            <ThemeToggle />
                            <SessionAvatar />
                        </div>
                    </header>

                    <main className='page-view animate-enter flex-1 overflow-y-auto px-4'>
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    );
};

export default DashboardLayout;
