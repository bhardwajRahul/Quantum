import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { LoadingScreen } from '@components/atoms/kit';

const ProtectedRoute = ({ mode }) => {
    const { authStatus } = useSelector((state) => state.auth);
    const location = useLocation();

    if(authStatus.isCachedAuthLoading) return <LoadingScreen />;

    if(mode === 'protect'){
        return authStatus.isAuthenticated
            ? <Outlet />
            : <Navigate to='/auth/sign-in' replace state={{ from: location }} />;
    }

    return authStatus.isAuthenticated
        ? <Navigate to='/dashboard' replace />
        : <Outlet />;
};

export default ProtectedRoute;
