/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
 *
 * OrgGate — tenancy gate that sits between the auth guard (ProtectedRoute,
 * mode='protect') and the persistent ShellLayout. Under the explicit-org-setup
 * model a user can be authenticated yet have ZERO organizations (fresh signup,
 * or they deleted their last org). The app is unusable in that state — every
 * resource hangs off an org — so we force the "Create your organization" screen
 * until one exists.
 *
 * While tenancy is still bootstrapping we render the same spinner the rest of the
 * app uses, to avoid flashing the setup screen before organizations have loaded.
****/

import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { LoadingScreen } from '@components/atoms/kit';

const SetupOrganization = lazy(() => import('@pages/protected/setup/SetupOrganization'));

const OrgGate = () => {
    const { organizations, isLoading } = useSelector((state) => state.tenancy);

    // Tenancy still resolving — don't flash the setup screen prematurely.
    if(isLoading) return <LoadingScreen />;

    // Authenticated but org-less → mandatory setup. No shell chrome.
    if(!organizations || organizations.length === 0){
        return (
            <Suspense fallback={<LoadingScreen />}>
                <SetupOrganization />
            </Suspense>
        );
    }

    // Has at least one org → proceed into the shell.
    return <Outlet />;
};

export default OrgGate;
