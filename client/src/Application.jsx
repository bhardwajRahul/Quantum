import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { LoadingScreen } from '@components/atoms/kit';
import { authenticateWithCachedToken } from '@services/authentication/utils';
import { bootstrapTenancy } from '@services/tenancy/operations';
import ProtectedRoute from '@components/organisms/ProtectedRoute';
import AppShell from '@components/organisms/AppShell';
import OrgGate from '@components/organisms/OrgGate';

const SignIn = lazy(() => import('@pages/guest/authentication/SignIn/SignIn'));
const SignUp = lazy(() => import('@pages/guest/authentication/SignUp/SignUp'));

const Account = lazy(() => import('@pages/protected/authentication/Account/Account'));
const ChangePassword = lazy(() => import('@pages/protected/authentication/ChangePassword/ChangePassword'));

const Authenticate = lazy(() => import('@pages/protected/github/Authenticate/Authenticate'));
const NeedAuthenticate = lazy(() => import('@pages/protected/github/NeedAuthenticate/NeedAuthenticate'));

const CreateRepository = lazy(() => import('@pages/protected/repository/CreateRepository/CreateRepository'));
const RepositoryShell = lazy(() => import('@pages/protected/repository/Shell/Shell'));
const RepositoryDeployments = lazy(() => import('@pages/protected/repository/RepositoryDeployments/RepositoryDeployments'));
const SetupDeployment = lazy(() => import('@pages/protected/repository/SetupDeployment/SetupDeloyment'));
const RepositoryEnvironmentVariables = lazy(() => import('@pages/protected/repository/EnvironmentVariables/EnvironmentVariables'));

const Dashboard = lazy(() => import('@pages/protected/general/Dashboard/Dashboard'));
const Applications = lazy(() => import('@pages/protected/platform/Applications/Applications'));
const Projects = lazy(() => import('@pages/protected/platform/Projects/Projects'));
const Domains = lazy(() => import('@pages/protected/platform/Domains/Domains'));
const Metrics = lazy(() => import('@pages/protected/platform/Metrics/Metrics'));
const Templates = lazy(() => import('@pages/protected/platform/Templates/Templates'));
const WebAnalytics = lazy(() => import('@pages/protected/platform/WebAnalytics/WebAnalytics'));
const Usage = lazy(() => import('@pages/protected/platform/Usage/Usage'));
const Codespaces = lazy(() => import('@pages/protected/platform/Codespaces/Codespaces'));
const Events = lazy(() => import('@pages/protected/platform/Events/Events'));

const Team = lazy(() => import('@pages/protected/settings/Team/Team'));
const OrganizationSettings = lazy(() => import('@pages/protected/settings/OrganizationSettings/OrganizationSettings'));

const Fallback = () => <LoadingScreen minHeight='60vh' />;

const RootRedirect = () => {
    const { authStatus } = useSelector((state) => state.auth);
    if(authStatus.isCachedAuthLoading) return <Fallback />;
    return <Navigate to={authStatus.isAuthenticated ? '/dashboard' : '/auth/sign-in'} replace />;
};

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

    useEffect(() => {
        authenticateWithCachedToken(dispatch);
    }, [dispatch]);

    useEffect(() => {
        if(authStatus.isAuthenticated){
            dispatch(bootstrapTenancy({ organizationId: tenancyOrgId, projectId: tenancyProjectId }));
        }

    }, [authStatus.isAuthenticated, dispatch]);

    return (
        <Routes location={location}>

            <Route path='/' element={<RootRedirect />} />

            <Route element={<ProtectedRoute mode='guest' />}>
                <Route path='/auth/sign-in' element={<Suspense fallback={<Fallback />}><SignIn /></Suspense>} />
                <Route path='/auth/sign-up' element={<Suspense fallback={<Fallback />}><SignUp /></Suspense>} />
            </Route>

            <Route element={<ProtectedRoute mode='protect' />}>
                <Route element={<OrgGate />}>
                    <Route element={<ShellLayout />}>
                    <Route path='/dashboard' element={<Dashboard />} />
                    <Route path='/applications' element={<Applications />} />
                    <Route path='/projects' element={<Projects />} />
                    <Route path='/domains' element={<Domains />} />
                    <Route path='/metrics' element={<Metrics />} />
                    <Route path='/templates' element={<Templates />} />
                    <Route path='/web-analytics' element={<WebAnalytics />} />
                    <Route path='/usage' element={<Usage />} />
                    <Route path='/codespaces' element={<Codespaces />} />
                    <Route path='/events' element={<Events />} />

                    <Route path='/settings'>
                        <Route path='team' element={<Team />} />
                        <Route path='organization' element={<OrganizationSettings />} />
                    </Route>

                    <Route path='/auth/account'>
                        <Route index element={<Account />} />
                        <Route path='change-password' element={<ChangePassword />} />
                    </Route>

                    <Route path='/github'>
                        <Route path='authenticate' element={<Authenticate />} />
                        <Route path='need-authenticate' element={<NeedAuthenticate />} />
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

            <Route path='*' element={<RootRedirect />} />
        </Routes>
    );
};

export default Application;
