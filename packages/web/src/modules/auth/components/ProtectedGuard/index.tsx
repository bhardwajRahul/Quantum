import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '@/modules/auth/hooks/use-session';
import RouteLoader from '@/shared/components/routing/RouteLoader';
import ServerUnreachable from '@/shared/components/routing/ServerUnreachable';

const ProtectedGuard = () => {
    const { isAuthenticated, isLoading, isUnreachable, retry } = useSession();
    const location = useLocation();

    if(isLoading) return <RouteLoader />;
    if(isUnreachable) return <ServerUnreachable onRetry={retry} />;

    if(!isAuthenticated){
        const next = encodeURIComponent(location.pathname + location.search);
        return <Navigate to={`/sign-in?next=${next}`} replace />;
    }

    return <Outlet />;
};

export default ProtectedGuard;
