import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { LoadingScreen } from '@components/atoms/kit';

const SetupOrganization = lazy(() => import('@pages/protected/setup/SetupOrganization'));

const OrgGate = () => {
    const { organizations, isLoading } = useSelector((state) => state.tenancy);

    if(isLoading) return <LoadingScreen />;

    if(!organizations || organizations.length === 0){
        return (
            <Suspense fallback={<LoadingScreen />}>
                <SetupOrganization />
            </Suspense>
        );
    }

    return <Outlet />;
};

export default OrgGate;
