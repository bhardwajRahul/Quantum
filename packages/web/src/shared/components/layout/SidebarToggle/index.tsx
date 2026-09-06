import { PanelLeft } from 'lucide-react';
import { useSidebarStore } from '@/shared/store/sidebar';

const SidebarToggle = () => {
    const collapsed = useSidebarStore((state) => state.collapsed);
    const toggle = useSidebarStore((state) => state.toggle);

    return (
        <button
            type='button'
            aria-label={collapsed ? 'Show navigation labels' : 'Collapse navigation'}
            aria-expanded={!collapsed}
            onClick={toggle}
            className='hidden size-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:text-foreground focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-foreground motion-reduce:transition-none lg:inline-flex'
        >
            <PanelLeft className='size-4' aria-hidden='true' />
        </button>
    );
};

export default SidebarToggle;
