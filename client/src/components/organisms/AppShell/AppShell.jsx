import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
    LayoutDashboard, Rocket, FolderKanban, Globe, LayoutTemplate,
    Activity, Bell, Users,
    Settings, LogOut, Sun, Moon, Menu as MenuIcon, ChevronsUpDown, User, Check,
    BarChart3, TrendingUp, Code2, Rss
} from 'lucide-react';
import { logout } from '@services/authentication/operations';
import { toggleTheme, LIGHT } from '@services/core/themeSlice';
import { clearUnread } from '@services/activity/slice';
import useTenancy from '@hooks/common/useTenancy';
import useActivityStream from '@hooks/ws/useActivityStream';
import useDeploymentStatus from '@hooks/ws/useDeploymentStatus';
import StatusBar from '@components/organisms/StatusBar';
import { userName, userEmail } from '@utilities/common/userDisplay';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuLabel, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

const NAV_GROUPS = [
    { title: null, items: [{ label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard }] },
    {
        title: 'Deploy',
        items: [
            { label: 'Applications', to: '/applications', icon: Rocket },
            { label: 'Projects', to: '/projects', icon: FolderKanban },
            { label: 'Domains', to: '/domains', icon: Globe },
            { label: 'Templates', to: '/templates', icon: LayoutTemplate },
            { label: 'Codespaces', to: '/codespaces', icon: Code2 }
        ]
    },
    {
        title: 'Observe',
        items: [
            { label: 'Metrics', to: '/metrics', icon: Activity },
            { label: 'Events', to: '/events', icon: Rss },
            { label: 'Web Analytics', to: '/web-analytics', icon: BarChart3 },
            { label: 'Usage', to: '/usage', icon: TrendingUp }
        ]
    },
    {
        title: 'Settings',
        items: [
            { label: 'Team', to: '/settings/team', icon: Users },
            { label: 'Organization', to: '/settings/organization', icon: Settings }
        ]
    }
];

const initials = (str) => {
    const s = String(str || '').trim();
    if(!s) return 'Q';
    const parts = s.split(/[\s@._-]+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || s[0].toUpperCase();
};

const Switcher = ({ label, items, selectedId, onSelect, emptyLabel }) => {
    const selected = items.find((i) => String(i._id) === String(selectedId));
    const display = selected ? (selected.name || selected.slug || selected._id) : (items.length ? 'Select' : emptyLabel);
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type='button'
                    disabled={!items.length}
                    className='flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50 transition-colors'
                >
                    <span className='hidden sm:inline text-xs text-muted-foreground'>{label}</span>
                    <span className='max-w-[10rem] truncate font-medium text-foreground'>{display}</span>
                    <ChevronsUpDown className='h-3.5 w-3.5 text-muted-foreground' />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start' className='max-h-72 overflow-y-auto qt-scroll'>
                <DropdownMenuLabel>{label}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {items.length === 0 ? (
                    <DropdownMenuItem disabled>{emptyLabel}</DropdownMenuItem>
                ) : items.map((item) => (
                    <DropdownMenuItem key={item._id} onClick={() => onSelect(String(item._id))} className='justify-between'>
                        <span className='truncate'>{item.name || item.slug || item._id}</span>
                        {String(item._id) === String(selectedId) && <Check className='h-4 w-4 text-primary' />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

const TenantBar = () => {
    const { organizations, projects, organizationId, projectId, selectOrganization, selectProject } = useTenancy();
    if(!organizations.length) return null;
    return (
        <div className='flex items-center gap-1 min-w-0'>
            <Switcher label='Org' items={organizations} selectedId={organizationId} onSelect={selectOrganization} emptyLabel='No orgs' />
            <span className='text-muted-foreground/50 select-none'>/</span>
            <Switcher label='Project' items={projects} selectedId={projectId} onSelect={selectProject} emptyLabel='No projects' />
        </div>
    );
};

const LEVEL_DOT = {
    success: 'bg-success',
    progress: 'bg-warning',
    warn: 'bg-warning',
    error: 'bg-destructive',
    info: 'bg-muted-foreground'
};

const relativeTime = (ts) => {
    if(!ts) return '';
    const then = new Date(ts).getTime();
    if(Number.isNaN(then)) return '';
    const s = Math.floor(Math.max(0, Date.now() - then) / 1000);
    if(s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if(m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if(h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

const ActivityBell = ({ onNavigate }) => {
    const dispatch = useDispatch();
    const events = useSelector((state) => state.activity.events);
    const unread = useSelector((state) => state.activity.unread);
    const recent = events.slice(0, 15);

    const onOpenChange = (open) => {
        if(open && unread > 0) dispatch(clearUnread());
    };

    return (
        <DropdownMenu onOpenChange={onOpenChange}>
            <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon' className='relative' aria-label='Activity'>
                    <Bell className='h-[18px] w-[18px]' />
                    {unread > 0 && (
                        <span className='absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-medium leading-none text-primary-foreground'>
                            {unread > 99 ? '99+' : unread}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-80 p-0'>
                <div className='flex items-center justify-between px-3 py-2.5'>
                    <span className='text-sm font-medium text-foreground'>Activity</span>
                    <button
                        type='button'
                        onClick={() => onNavigate('/events')}
                        className='text-xs text-primary hover:underline'
                    >
                        View all
                    </button>
                </div>
                <DropdownMenuSeparator className='my-0' />
                <div className='max-h-96 overflow-y-auto qt-scroll py-1'>
                    {recent.length === 0 ? (
                        <p className='px-3 py-8 text-center text-sm text-muted-foreground'>No activity yet.</p>
                    ) : recent.map((e, i) => (
                        <div key={e._id || `${e.ts}-${i}`} className='flex items-start gap-2.5 px-3 py-2 hover:bg-accent/60'>
                            <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', LEVEL_DOT[e.level] || 'bg-muted-foreground')} />
                            <div className='min-w-0 flex-1'>
                                <p className='truncate text-sm text-foreground'>{e.title || '—'}</p>
                                <p className='text-xs text-muted-foreground'>{relativeTime(e.ts)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

const NavLinks = ({ isActive, go }) => (
    <nav className='flex flex-col gap-6 px-3 py-4'>
        {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className='flex flex-col gap-0.5'>
                {group.title && (
                    <p className='px-3 pb-1 text-xs font-medium text-muted-foreground/60'>{group.title}</p>
                )}
                {group.items.map(({ label, to, icon: Icon }) => {
                    const active = isActive(to);
                    return (
                        <button
                            key={to}
                            type='button'
                            onClick={() => go(to)}
                            className={cn(
                                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors text-left',
                                active
                                    ? 'bg-accent font-medium text-foreground'
                                    : 'font-normal text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                            )}
                        >
                            <Icon className='h-[18px] w-[18px] shrink-0' strokeWidth={active ? 2 : 1.75} />
                            {label}
                        </button>
                    );
                })}
            </div>
        ))}
    </nav>
);

const UserFooter = ({ user, onLogout, navigate }) => {
    const name = userName(user);
    const email = userEmail(user);
    return (
        <div className='border-t border-sidebar-border p-3'>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button type='button' className='flex w-full items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent/60 transition-colors'>
                        <Avatar className='h-8 w-8'>
                            <AvatarFallback className='bg-muted text-muted-foreground text-xs font-medium'>{initials(name)}</AvatarFallback>
                        </Avatar>
                        <div className='min-w-0 flex-1 text-left'>
                            <p className='truncate text-sm font-medium text-sidebar-foreground'>{name}</p>
                            {email !== '—' && <p className='truncate text-xs text-muted-foreground'>{email}</p>}
                        </div>
                        <ChevronsUpDown className='h-4 w-4 text-muted-foreground' />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' side='top' className='w-56'>
                    <DropdownMenuItem onClick={() => navigate('/auth/account')}><User className='mr-2 h-4 w-4' /> Account</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/settings/organization')}><Settings className='mr-2 h-4 w-4' /> Organization</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onLogout} className='text-destructive focus:text-destructive'><LogOut className='mr-2 h-4 w-4' /> Log out</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};

const AppShell = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch();
    const theme = useSelector((state) => state.theme.theme);
    const user = useSelector((state) => state.auth.user);
    const isLight = theme === LIGHT;
    const [mobileOpen, setMobileOpen] = useState(false);

    useActivityStream(true);
    useDeploymentStatus(true);

    const onLogout = async () => {
        await dispatch(logout());
        navigate('/auth/sign-in/');
    };

    const isActive = (to) => {
        if(location.pathname === to) return true;
        const seg = '/' + to.split('/').filter(Boolean)[0];
        return to !== seg ? location.pathname.startsWith(to) : (location.pathname === seg || location.pathname.startsWith(seg + '/'));
    };

    const go = (to) => { navigate(to); setMobileOpen(false); };

    const SidebarInner = (
        <div className='flex h-full flex-col'>
            <div className='flex-1 overflow-y-auto qt-scroll'>
                <NavLinks isActive={isActive} go={go} />
            </div>
            <UserFooter user={user} onLogout={onLogout} navigate={navigate} />
        </div>
    );

    return (
        <div className='min-h-screen bg-background'>

            <aside className='hidden lg:block fixed inset-y-0 left-0 z-40 w-60 bg-sidebar'>
                {SidebarInner}
            </aside>

            {mobileOpen && (
                <div className='fixed inset-0 z-50 lg:hidden'>
                    <div className='absolute inset-0 bg-black/50' onClick={() => setMobileOpen(false)} />
                    <aside className='absolute inset-y-0 left-0 w-60 border-r border-sidebar-border bg-sidebar'>
                        {SidebarInner}
                    </aside>
                </div>
            )}

            <div className='lg:pl-60'>
                <div className='flex min-h-screen flex-col px-0 pb-8 lg:py-3 lg:pr-3'>
                    <div className='flex flex-1 flex-col overflow-hidden border border-border bg-card lg:rounded-xl'>
                        <header className='flex h-14 items-center gap-3 border-b border-border px-4 sm:px-6'>
                            <Button variant='ghost' size='icon' className='lg:hidden -ml-2' onClick={() => setMobileOpen(true)} aria-label='Open menu'>
                                <MenuIcon className='h-5 w-5' />
                            </Button>

                            <TenantBar />

                            <div className='ml-auto flex items-center gap-1'>
                                <ActivityBell onNavigate={go} />
                                <Button variant='ghost' size='icon' onClick={() => dispatch(toggleTheme())} aria-label='Toggle theme'>
                                    {isLight ? <Moon className='h-[18px] w-[18px]' /> : <Sun className='h-[18px] w-[18px]' />}
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant='ghost' size='icon' aria-label='Account'>
                                            <User className='h-[18px] w-[18px]' />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align='end' className='w-48'>
                                        <DropdownMenuItem onClick={() => navigate('/auth/account')}><User className='mr-2 h-4 w-4' /> Account</DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={onLogout} className='text-destructive focus:text-destructive'><LogOut className='mr-2 h-4 w-4' /> Log out</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </header>

                        <main className='flex-1 overflow-y-auto qt-scroll px-4 py-8 pb-16 sm:px-8'>
                            <div key={location.pathname} className='qt-page-enter mx-auto w-full max-w-6xl'>
                                {children}
                            </div>
                        </main>
                    </div>
                </div>
            </div>

            <StatusBar />
        </div>
    );
};

export default AppShell;
