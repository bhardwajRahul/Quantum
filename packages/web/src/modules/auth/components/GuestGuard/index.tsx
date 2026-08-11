import { Navigate, Outlet, useSearchParams } from 'react-router-dom';
import { useSession } from '@/modules/auth/hooks/use-session';
import RouteLoader from '@/shared/components/routing/RouteLoader';

const GuestGuard = () => {
    const { isAuthenticated, isLoading } = useSession();
    const [params] = useSearchParams();

    if(isLoading) return <RouteLoader />;
    if(isAuthenticated){
        const next = params.get('next');
        const to = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
        return <Navigate to={to} replace />;
    }
    return <Outlet />;
};

export default GuestGuard;
