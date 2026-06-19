/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
****/

import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { LoadingScreen } from '@components/atoms/kit';
import { authenticateWithCachedToken } from '@services/authentication/utils';
import { bootstrapTenancy } from '@services/tenancy/operations';
import ProtectedRoute from '@components/organisms/ProtectedRoute';
import AppShell from '@components/organisms/AppShell';
import OrgGate from '@components/organisms/OrgGate';

// Auth (no shell — full-screen Carbon auth pages)
const SignIn = lazy(() => import('@pages/guest/authentication/SignIn/SignIn'));
const SignUp = lazy(() => import('@pages/guest/authentication/SignUp/SignUp'));

// Account
const Account = lazy(() => import('@pages/protected/authentication/Account/Account'));
const ChangePassword = lazy(() => import('@pages/protected/authentication/ChangePassword/ChangePassword'));

// GitHub connect
const Authenticate = lazy(() => import('@pages/protected/github/Authenticate/Authenticate'));
const NeedAuthenticate = lazy(() => import('@pages/protected/github/NeedAuthenticate/NeedAuthenticate'));

// Docker
const CreateDockerContainer = lazy(() => import('@pages/protected/docker/container/CreateDockerContainer/CreateDockerContainer'));
const DockerContainerExplorer = lazy(() => import('@pages/protected/docker/container/Explorer/Explorer'));
const DockerContainerShell = lazy(() => import('@pages/protected/docker/container/Shell/Shell'));
const DockerContainerEnvironmentVariables = lazy(() => import('@pages/protected/docker/container/EnvironmentVariables/EnvironmentVariables'));
const DockerContainerStorage = lazy(() => import('@pages/protected/docker/container/Storage/Storage'));
const CreateDockerImage = lazy(() => import('@pages/protected/docker/image/CreateDockerImage/CreateDockerImage'));
const DockerImageExplorer = lazy(() => import('@pages/protected/docker/image/Explorer/Explorer'));

// Repository
const CreateRepository = lazy(() => import('@pages/protected/repository/CreateRepository/CreateRepository'));
const RepositoryShell = lazy(() => import('@pages/protected/repository/Shell/Shell'));
const RepositoryDeployments = lazy(() => import('@pages/protected/repository/RepositoryDeployments/RepositoryDeployments'));
const SetupDeployment = lazy(() => import('@pages/protected/repository/SetupDeployment/SetupDeloyment'));
const RepositoryEnvironmentVariables = lazy(() => import('@pages/protected/repository/EnvironmentVariables/EnvironmentVariables'));

// Platform
const Dashboard = lazy(() => import('@pages/protected/general/Dashboard/Dashboard'));
const Applications = lazy(() => import('@pages/protected/platform/Applications/Applications'));
const Projects = lazy(() => import('@pages/protected/platform/Projects/Projects'));
const Databases = lazy(() => import('@pages/protected/platform/Databases/Databases'));
const Domains = lazy(() => import('@pages/protected/platform/Domains/Domains'));
const Metrics = lazy(() => import('@pages/protected/platform/Metrics/Metrics'));
const Templates = lazy(() => import('@pages/protected/platform/Templates/Templates'));
const Alerting = lazy(() => import('@pages/protected/platform/Alerting/Alerting'));
const WebAnalytics = lazy(() => import('@pages/protected/platform/WebAnalytics/WebAnalytics'));
const Usage = lazy(() => import('@pages/protected/platform/Usage/Usage'));
const Codespaces = lazy(() => import('@pages/protected/platform/Codespaces/Codespaces'));
const Events = lazy(() => import('@pages/protected/platform/Events/Events'));

// Settings
const Team = lazy(() => import('@pages/protected/settings/Team/Team'));
const ApiTokens = lazy(() => import('@pages/protected/settings/ApiTokens/ApiTokens'));
const OrganizationSettings = lazy(() => import('@pages/protected/settings/OrganizationSettings/OrganizationSettings'));
const OrgEnvVars = lazy(() => import('@pages/protected/settings/OrgEnvVars/OrgEnvVars'));

const Fallback = () => <LoadingScreen minHeight='60vh' />;

/** Root '/' → dashboard when authenticated, otherwise the sign-in screen. */
const RootRedirect = () => {
    const { authStatus } = useSelector((state) => state.auth);
    if(authStatus.isCachedAuthLoading) return <Fallback />;
    return <Navigate to={authStatus.isAuthenticated ? '/dashboard' : '/auth/sign-in'} replace />;
};

/** Persistent app layout: the shell mounts ONCE and only the routed content
 *  (the <Outlet/>) swaps on navigation. Wrapping each route in its own
 *  <AppShell> instead remounts the whole chrome on every navigation — that was
 *  the flicker, the re-fired health poll, and the orphaned Radix pointer locks
 *  that broke the row dropdown menus. */
const ShellLayout = () => (
    <AppShell>
        <Suspense fallback={<Fallback />}>
            <Outlet />
        </Suspense>
    </AppShell>
);

const Application = () => {
    const location = useLocation();
    const dispatch = useDispatch();
    const { authStatus } = useSelector((state) => state.auth);
    const tenancyOrgId = useSelector((state) => state.tenancy.organizationId);
    const tenancyProjectId = useSelector((state) => state.tenancy.projectId);

    // Bootstrap the session from the persisted cookie once at startup. The old
    // Layout used to do this; with the Carbon shell it lives here so every route
    // (including '/') resolves auth correctly on a fresh load / refresh.
    useEffect(() => {
        authenticateWithCachedToken(dispatch);
    }, [dispatch]);

    // Once authenticated, resolve the tenant context (org + project). Most
    // resource endpoints are project-scoped, so the SPA needs a selected project
    // before those pages can address them. Re-runs only on auth transition; the
    // persisted ids are repaired against the live lists inside bootstrapTenancy.
    useEffect(() => {
        if(authStatus.isAuthenticated){
            dispatch(bootstrapTenancy({ organizationId: tenancyOrgId, projectId: tenancyProjectId }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authStatus.isAuthenticated, dispatch]);

    return (
        <Routes location={location}>
            {/* Root + any unknown path resolve to dashboard-or-sign-in. */}
            <Route path='/' element={<RootRedirect />} />

            {/* Guest-only auth screens (no shell). */}
            <Route element={<ProtectedRoute mode='guest' />}>
                <Route path='/auth/sign-in' element={<Suspense fallback={<Fallback />}><SignIn /></Suspense>} />
                <Route path='/auth/sign-up' element={<Suspense fallback={<Fallback />}><SignUp /></Suspense>} />
            </Route>

            {/* Everything protected renders inside ONE persistent shell (Outlet).
                OrgGate sits between auth and the shell: an authenticated user with
                no organization is forced through the "Create your organization"
                setup screen before any shell route renders. */}
            <Route element={<ProtectedRoute mode='protect' />}>
                <Route element={<OrgGate />}>
                    <Route element={<ShellLayout />}>
                    <Route path='/dashboard' element={<Dashboard />} />
                    <Route path='/applications' element={<Applications />} />
                    <Route path='/projects' element={<Projects />} />
                    <Route path='/databases' element={<Databases />} />
                    <Route path='/domains' element={<Domains />} />
                    <Route path='/metrics' element={<Metrics />} />
                    <Route path='/templates' element={<Templates />} />
                    <Route path='/alerting' element={<Alerting />} />
                    <Route path='/web-analytics' element={<WebAnalytics />} />
                    <Route path='/usage' element={<Usage />} />
                    <Route path='/codespaces' element={<Codespaces />} />
                    <Route path='/events' element={<Events />} />

                    <Route path='/settings'>
                        <Route path='team' element={<Team />} />
                        <Route path='api-tokens' element={<ApiTokens />} />
                        <Route path='organization' element={<OrganizationSettings />} />
                        <Route path='env-vars' element={<OrgEnvVars />} />
                    </Route>

                    <Route path='/auth/account'>
                        <Route index element={<Account />} />
                        <Route path='change-password' element={<ChangePassword />} />
                    </Route>

                    <Route path='/github'>
                        <Route path='authenticate' element={<Authenticate />} />
                        <Route path='need-authenticate' element={<NeedAuthenticate />} />
                    </Route>

                    <Route path='/docker-container'>
                        <Route path='create' element={<CreateDockerContainer />} />
                        <Route path='explore' element={<DockerContainerExplorer />} />
                        <Route path=':dockerId'>
                            <Route path='update' element={<CreateDockerContainer />} />
                            <Route path='shell' element={<DockerContainerShell />} />
                            <Route path='environment-variables' element={<DockerContainerEnvironmentVariables />} />
                            <Route path='storage' element={<DockerContainerStorage />} />
                        </Route>
                    </Route>

                    <Route path='/docker-image'>
                        <Route path='create' element={<CreateDockerImage />} />
                        <Route path='explore' element={<DockerImageExplorer />} />
                        <Route path=':networkId/update' element={<CreateDockerImage />} />
                    </Route>

                    <Route path='/repository'>
                        <Route path='create' element={<CreateRepository />} />
                        <Route path=':repositoryAlias'>
                            <Route path='shell' element={<RepositoryShell />} />
                            <Route path='deployments' element={<RepositoryDeployments />} />
                            <Route path='deployment'>
                                <Route path='setup' element={<SetupDeployment />} />
                                <Route path='environment-variables' element={<RepositoryEnvironmentVariables />} />
                            </Route>
                        </Route>
                    </Route>
                </Route>
                </Route>
            </Route>

            {/* Unknown paths → root redirect. */}
            <Route path='*' element={<RootRedirect />} />
        </Routes>
    );
};

export default Application;
