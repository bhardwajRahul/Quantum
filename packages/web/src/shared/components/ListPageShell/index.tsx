import EmptyState from '@/shared/components/EmptyState';
import ErrorState from '@/shared/components/ErrorState';
import CenterState from '@/shared/components/CenterState';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface ListPageStateSpec{
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
}

interface ListPageShellProps{
    loading?: boolean;
    loadingTitle: string;
    loadingDescription?: string;
    compact?: boolean;
    error?: Error | undefined;
    errorTitle: string;
    getErrorDescription: (error: Error) => string;
    onRetry: () => void;
    showPrompt?: boolean;
    prompt?: ListPageStateSpec;
    isEmpty?: boolean;
    empty?: ListPageStateSpec;
    fill?: boolean;
    bare?: boolean;
    children?: ReactNode;
}

const ListPageShell = ({
    loading = false,
    loadingTitle,
    loadingDescription,
    compact = true,
    error = undefined,
    errorTitle,
    getErrorDescription,
    onRetry,
    showPrompt = false,
    prompt,
    isEmpty = false,
    empty,
    fill = false,
    bare = false,
    children
}: ListPageShellProps) => {
    const wrap = (node: ReactNode) => {
        if(bare) return <>{node}</>;
        return <CenterState className={fill ? 'h-full' : undefined}>{node}</CenterState>;
    };

    if(showPrompt && prompt !== undefined){
        return wrap(
            <EmptyState icon={prompt.icon} title={prompt.title} description={prompt.description}>
                {prompt.action}
            </EmptyState>
        );
    }

    if(loading){
        return wrap(<EmptyState title={loadingTitle} description={loadingDescription} compact={compact} />);
    }

    if(error !== undefined){
        return wrap(<ErrorState title={errorTitle} description={getErrorDescription(error)} onRetry={onRetry} />);
    }

    if(isEmpty && empty !== undefined){
        return wrap(
            <EmptyState icon={empty.icon} title={empty.title} description={empty.description}>
                {empty.action}
            </EmptyState>
        );
    }

    return <>{children}</>;
};

export default ListPageShell;
