/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
****/

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { LoadingScreen } from '@components/atoms/kit';

/**
 * Route guard.
 *  - mode='protect': requires an authenticated session, else → /auth/sign-in.
 *  - mode='guest':   only for unauthenticated visitors, else → /dashboard.
 * While the cached-token check is in flight we render a spinner so we never
 * flash the wrong screen.
 */
const ProtectedRoute = ({ mode }) => {
    const { authStatus } = useSelector((state) => state.auth);
    const location = useLocation();

    if(authStatus.isCachedAuthLoading) return <LoadingScreen />;

    if(mode === 'protect'){
        return authStatus.isAuthenticated
            ? <Outlet />
            : <Navigate to='/auth/sign-in' replace state={{ from: location }} />;
    }

    // guest
    return authStatus.isAuthenticated
        ? <Navigate to='/dashboard' replace />
        : <Outlet />;
};

export default ProtectedRoute;
